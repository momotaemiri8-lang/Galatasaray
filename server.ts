import express from 'express';
import path from 'path';
import Stripe from 'stripe';
import { createServer as createViteServer } from 'vite';
import {
  requireAuth,
  requireAdmin,
  requireVerifiedUser,
  rateLimitAuth,
  AuthRequest,
} from './src/middleware/auth.ts';
import {
  hashPasswordScrypt,
  verifyPasswordScrypt,
  validatePasswordStrength,
  isValidEmailFormat,
  generateSecureToken,
  hashOpaqueToken,
  createAuthenticatedSession,
  findUserByEmailCaseInsensitive,
  sanitizeUserForClient,
  dispatchTransactionalAuthEmail,
  normalizeRole,
} from './src/lib/authService.ts';
import {
  getPublicBootstrapData,
  getShipmentWithEvents,
  getUserDashboardBundle,
  getAdminOverviewBundle,
  getOrCreateUser,
  logAdminAction,
} from './src/db/repository.ts';
import {
  getAllIntegrationStatuses,
  testStripeIntegration,
  testPayPalIntegration,
  testDhlIntegration,
  testSmtpIntegration,
  verifyStripePaymentServerSide,
  createStripeCheckoutPaymentIntent,
  createPayPalOrderServerSide,
  getPayPalOrderServerSide,
  verifyAndCapturePayPalOrderServerSide,
  fetchLiveDhlTracking,
  sanitizeProviderError,
} from './src/lib/integrations.ts';
import { db } from './src/db/index.ts';
import {
  users,
  authSessions,
  membershipTiers,
  players,
  matches,
  meetSessions,
  meetBookings,
  academyApplications,
  products,
  auctions,
  auctionBids,
  orders,
  shipments,
  trackingEvents,
  cmsArticles,
  supportTickets,
  notifications,
  siteConfigurations,
  newsletterSubscriptions,
  matchEvents,
  matchLineups,
  competitionStandings,
  footballApiConfigs,
} from './src/db/schema.ts';
import {
  getMatchCentreBundle,
  syncLiveFootballDataFromProvider,
  getOrCreateFootballApiConfig,
} from './src/lib/footballDataService.ts';
import { eq } from 'drizzle-orm';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // ============================================================================
  // STRIPE WEBHOOK VERIFICATION ENDPOINT (RAW REQUEST BODY REQUIRED)
  // ============================================================================
  app.post(
    '/api/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const sig = req.headers['stripe-signature'];
      const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

      if (!secretKey || !webhookSecret || secretKey.includes('placeholder') || webhookSecret.includes('placeholder')) {
        return res.status(503).json({
          error: 'Stripe webhook signing secret or API key is not configured on the server.',
        });
      }

      if (!sig) {
        return res.status(400).json({ error: 'Missing stripe-signature header.' });
      }

      let event: Stripe.Event;
      try {
        const stripe = new Stripe(secretKey);
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err: any) {
        const safeMsg = sanitizeProviderError(err?.message || 'Webhook signature verification failed.');
        return res.status(400).json({ error: `Webhook Error: ${safeMsg}` });
      }

      try {
        if (event.type === 'payment_intent.succeeded') {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const matchingOrders = await db
            .select()
            .from(orders)
            .where(eq(orders.paymentIntentId, paymentIntent.id));

          if (matchingOrders.length > 0) {
            const ord = matchingOrders[0];
            await db
              .update(orders)
              .set({ status: 'Paid' })
              .where(eq(orders.id, ord.id));

            await db
              .update(shipments)
              .set({ status: 'Payment Confirmed', updatedAt: new Date() })
              .where(eq(shipments.orderNumber, ord.orderNumber));

            await db.insert(trackingEvents).values({
              trackingNumber: ord.trackingNumber,
              stage: 'Payment Confirmed',
              facility: 'Stripe Webhook Verification Gateway',
              description: `Server-verified Stripe webhook payment_intent.succeeded for ${ord.orderNumber}.`,
              eventTimestamp: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
            });

            await logAdminAction(
              'stripe-webhook@system',
              'Verified Stripe Webhook payment_intent.succeeded',
              ord.orderNumber,
              ord.status,
              'Paid'
            );
          }
        } else if (event.type === 'payment_intent.payment_failed') {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const matchingOrders = await db
            .select()
            .from(orders)
            .where(eq(orders.paymentIntentId, paymentIntent.id));

          if (matchingOrders.length > 0) {
            const ord = matchingOrders[0];
            await db
              .update(orders)
              .set({ status: 'Payment Failed' })
              .where(eq(orders.id, ord.id));

            await logAdminAction(
              'stripe-webhook@system',
              'Stripe Webhook payment_intent.payment_failed',
              ord.orderNumber,
              ord.status,
              'Payment Failed'
            );
          }
        }
        res.json({ received: true });
      } catch (err: any) {
        res.status(500).json({ error: 'Failed to process verified webhook event.' });
      }
    }
  );

  app.use(express.json({ limit: '5mb' }));

  // 1. Public Bootstrap Endpoint
  app.get('/api/bootstrap', async (_req, res) => {
    try {
      const [data, integrations, matchCentre] = await Promise.all([
        getPublicBootstrapData(),
        getAllIntegrationStatuses(),
        getMatchCentreBundle(),
      ]);
      res.json({
        ...data,
        matchCentre,
        integrationSummary: integrations.map((i) => ({
          provider: i.provider,
          title: i.title,
          environmentMode: i.environmentMode,
          allRequiredPresent: i.allRequiredPresent,
          connectionStatus: i.connectionStatus,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load club platform data.' });
    }
  });

  // 1b. Public Match Centre & Standings Endpoint
  app.get('/api/match-centre', async (_req, res) => {
    try {
      const bundle = await getMatchCentreBundle();
      res.json(bundle);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load Match Centre telemetry.' });
    }
  });

  // 1c. Public Newsletter Subscription Endpoint
  app.post('/api/newsletter/subscribe', async (req, res) => {
    try {
      const { email, supporterName, country } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        return res.status(400).json({ error: 'Please enter a valid supporter email address.' });
      }
      const inserted = await db
        .insert(newsletterSubscriptions)
        .values({
          email: cleanEmail,
          supporterName: supporterName || 'Global Supporter',
          country: country || 'International',
          active: true,
        })
        .onConflictDoUpdate({
          target: newsletterSubscriptions.email,
          set: { active: true },
        })
        .returning();

      res.json({ subscribed: true, subscription: inserted[0] });
    } catch (err: any) {
      res.status(500).json({ error: 'Unable to complete newsletter registration.' });
    }
  });

  // 2. Public Shipment Tracking Lookup + Optional Live MyDHL API Query
  app.get('/api/shipments/track/:trackingNumber', async (req, res) => {
    try {
      const trackingNum = req.params.trackingNumber.trim().toUpperCase();
      const useLiveDhl = req.query.mode === 'dhl_live';

      if (useLiveDhl) {
        const liveResult = await fetchLiveDhlTracking(trackingNum);
        if (!liveResult.supported) {
          return res.status(400).json({
            error: liveResult.error || 'Live DHL Express tracking is unavailable until MyDHL API credentials are configured.',
          });
        }
        return res.json({
          shipment: {
            trackingNumber: trackingNum,
            orderNumber: 'DHL-EXPRESS-LIVE',
            recipientName: 'Verified DHL Consignee',
            originFacility: 'DHL Express Origin Gateway',
            currentLocation: liveResult.currentLocation || 'DHL Express Network',
            destinationCity: 'International Destination',
            destinationCountry: '',
            courierProvider: 'DHL Express MyDHL API (Live Carrier Feed)',
            serviceLevel: 'DHL Express International',
            weightKg: '1.00',
            dimensionsCm: 'Standard Express Parcel',
            estimatedDelivery: 'Per DHL Carrier Schedule',
            status: liveResult.status || 'International Transit',
            dataSourceMode: 'Live Carrier API (MyDHL)',
          },
          events: (liveResult.liveEvents || []).map((ev, idx) => ({
            id: idx + 1,
            ...ev,
          })),
        });
      }

      const result = await getShipmentWithEvents(trackingNum);
      if (!result) {
        return res.status(404).json({
          error: 'No shipment found for that tracking number. Try GS-INTL-19058824TR or your order tracking number.',
        });
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Unable to track shipment.' });
    }
  });

  // 3. Public Membership QR Verification
  app.get('/api/memberships/verify/:memberNumber', async (req, res) => {
    try {
      const found = await db
        .select()
        .from(users)
        .where(eq(users.membershipNumber, req.params.memberNumber.trim()));
      if (!found.length) {
        return res.status(404).json({ verified: false, error: 'Membership credential not found.' });
      }
      const member = found[0];
      res.json({
        verified: member.membershipStatus === 'Active',
        fullName: member.fullName,
        membershipTier: member.membershipTier,
        membershipNumber: member.membershipNumber,
        membershipStatus: member.membershipStatus,
        membershipExpiry: member.membershipExpiry,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Unable to verify membership.' });
    }
  });

  // ============================================================================
  // SECURE USER REGISTRATION, EMAIL VERIFICATION, LOGIN, PASSWORD RESET & SESSION
  // ============================================================================

  // 3a. User Registration (Scrypt Hashing + Email Verification Token Issuance)
  app.post('/api/auth/register', rateLimitAuth(10, 60_000), async (req, res) => {
    try {
      const { fullName, email, password, confirmPassword, country } = req.body || {};
      const cleanName = String(fullName || '').trim();
      const cleanEmail = String(email || '').trim().toLowerCase();

      if (!cleanName || !cleanEmail || !password || !confirmPassword) {
        return res.status(400).json({
          error: 'All fields (Full Name, Email Address, Password, Confirm Password) are required.',
        });
      }

      if (!isValidEmailFormat(cleanEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address format.' });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Password and Confirm Password do not match.' });
      }

      const strength = validatePasswordStrength(password);
      if (!strength.valid) {
        return res.status(400).json({ error: strength.message });
      }

      const existing = await findUserByEmailCaseInsensitive(cleanEmail);
      if (existing && existing.passwordHash) {
        return res.status(409).json({
          error: 'An account with this email address is already registered. Please sign in instead.',
        });
      }

      const { salt, hash } = hashPasswordScrypt(password);
      const rawVerifyToken = generateSecureToken(24);
      const verifyTokenHash = hashOpaqueToken(rawVerifyToken);
      const verifyExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours
      const assignedRole = cleanEmail === 'luxmartsupport@gmail.com' ? 'ADMIN' : 'USER';
      const newUid = existing?.uid || `gs-usr-${generateSecureToken(10)}`;

      let savedUser;
      if (existing) {
        const updated = await db
          .update(users)
          .set({
            fullName: cleanName,
            passwordHash: hash,
            passwordSalt: salt,
            role: assignedRole,
            emailVerified: false,
            verificationTokenHash: verifyTokenHash,
            verificationTokenExpiresAt: verifyExpiresAt,
            country: country || existing.country || 'Turkey',
          })
          .where(eq(users.id, existing.id))
          .returning();
        savedUser = updated[0];
      } else {
        const inserted = await db
          .insert(users)
          .values({
            uid: newUid,
            email: cleanEmail,
            fullName: cleanName,
            country: country || 'Turkey',
            role: assignedRole,
            passwordHash: hash,
            passwordSalt: salt,
            emailVerified: false,
            verificationTokenHash: verifyTokenHash,
            verificationTokenExpiresAt: verifyExpiresAt,
          })
          .returning();
        savedUser = inserted[0];
      }

      const appBaseUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
      const verificationLink = `${appBaseUrl}/?authAction=verify-email&token=${rawVerifyToken}`;

      const emailResult = await dispatchTransactionalAuthEmail({
        to: cleanEmail,
        subject: 'Galatasaray SK Official Platform · Verify Your Email Address',
        text: `Welcome to Galatasaray SK, ${cleanName}.\n\nPlease verify your email address within 24 hours by opening this link:\n${verificationLink}\n\nVerification Code: ${rawVerifyToken}`,
        html: `<p>Welcome to <strong>Galatasaray SK Official Global Digital Platform</strong>, ${cleanName}.</p><p>Please verify your email address within 24 hours to activate full authenticated access:</p><p><a href="${verificationLink}">${verificationLink}</a></p>`,
      });

      await db.insert(notifications).values({
        userUid: savedUser.uid,
        title: 'Account Created · Email Verification Required',
        message: `Please verify your email address (${cleanEmail}) to unlock full supporter privileges.`,
        channel: 'In-Dashboard',
      });

      res.status(201).json({
        registered: true,
        requiresEmailVerification: true,
        user: sanitizeUserForClient(savedUser),
        emailDelivery: {
          sentViaSmtp: emailResult.sentViaSmtp,
          diagnostic: emailResult.diagnostic,
        },
        message: emailResult.sentViaSmtp
          ? `Registration complete! A verification link has been sent to ${cleanEmail}.`
          : `Account registered! Because external SMTP is not yet configured in AI Studio Secrets, please configure SMTP or ask an Administrator to verify your account, or use the Resend Verification tool once SMTP is active.`,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Unable to complete registration at this time.' });
    }
  });

  // 3b. Email Verification Endpoint (Validates Token & Expiration)
  app.post('/api/auth/verify-email', rateLimitAuth(15, 60_000), async (req, res) => {
    try {
      const { token } = req.body || {};
      const cleanToken = String(token || '').trim();
      if (!cleanToken) {
        return res.status(400).json({ error: 'Verification token is required.' });
      }

      const tokenHash = hashOpaqueToken(cleanToken);
      const matching = await db
        .select()
        .from(users)
        .where(eq(users.verificationTokenHash, tokenHash));

      if (!matching.length) {
        return res.status(400).json({
          error: 'Invalid verification token. The link may have already been used or is malformed.',
          code: 'INVALID_TOKEN',
        });
      }

      const targetUser = matching[0];
      if (targetUser.emailVerified) {
        return res.json({
          verified: true,
          message: 'Your email address is already verified. You may now sign in.',
        });
      }

      if (
        !targetUser.verificationTokenExpiresAt ||
        new Date(targetUser.verificationTokenExpiresAt).getTime() <= Date.now()
      ) {
        return res.status(400).json({
          error: 'This verification link has expired. Please request a new verification email.',
          code: 'EXPIRED_TOKEN',
        });
      }

      const updated = await db
        .update(users)
        .set({
          emailVerified: true,
          verificationTokenHash: '',
          verificationTokenExpiresAt: null,
        })
        .where(eq(users.id, targetUser.id))
        .returning();

      res.json({
        verified: true,
        user: sanitizeUserForClient(updated[0]),
        message: 'Email address verified! You now have full authenticated access.',
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Unable to verify email token.' });
    }
  });

  // 3c. Resend Verification Email
  app.post('/api/auth/resend-verification', rateLimitAuth(8, 60_000), async (req, res) => {
    try {
      const { email } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !isValidEmailFormat(cleanEmail)) {
        return res.status(400).json({ error: 'Please provide a valid email address.' });
      }

      const existing = await findUserByEmailCaseInsensitive(cleanEmail);
      if (!existing) {
        // Generic response to prevent enumeration
        return res.json({
          resent: true,
          message:
            'If an unverified account exists for that email address, a fresh verification link has been dispatched.',
        });
      }

      if (existing.emailVerified) {
        return res.status(400).json({
          error: 'This account is already verified. Please sign in.',
        });
      }

      const rawVerifyToken = generateSecureToken(24);
      const verifyTokenHash = hashOpaqueToken(rawVerifyToken);
      const verifyExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

      await db
        .update(users)
        .set({
          verificationTokenHash: verifyTokenHash,
          verificationTokenExpiresAt: verifyExpiresAt,
        })
        .where(eq(users.id, existing.id));

      const appBaseUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
      const verificationLink = `${appBaseUrl}/?authAction=verify-email&token=${rawVerifyToken}`;

      const emailResult = await dispatchTransactionalAuthEmail({
        to: cleanEmail,
        subject: 'Galatasaray SK · New Email Verification Link',
        text: `Here is your new email verification link (valid for 24 hours):\n${verificationLink}`,
        html: `<p>Here is your new email verification link (valid for 24 hours):</p><p><a href="${verificationLink}">${verificationLink}</a></p>`,
      });

      res.json({
        resent: true,
        sentViaSmtp: emailResult.sentViaSmtp,
        diagnostic: emailResult.diagnostic,
        message: emailResult.sentViaSmtp
          ? `A new verification link has been sent to ${cleanEmail}.`
          : `New verification token generated, but external SMTP is not configured in Secrets (${emailResult.diagnostic}).`,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Unable to resend verification email.' });
    }
  });

  // 3d. User Login (Email & Password + Account Lockout + Remember Session + HttpOnly Cookie)
  app.post('/api/auth/login', rateLimitAuth(12, 60_000), async (req, res) => {
    try {
      const { email, password, rememberMe } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();

      if (!cleanEmail || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const userRecord = await findUserByEmailCaseInsensitive(cleanEmail);
      if (!userRecord || !userRecord.passwordHash || !userRecord.passwordSalt) {
        return res.status(401).json({
          error: 'Invalid email address or password.',
        });
      }

      if (userRecord.accountDisabled) {
        return res.status(403).json({
          error: 'This account has been disabled by an administrator. Please contact club support.',
          code: 'ACCOUNT_DISABLED',
        });
      }

      if (userRecord.lockedUntil && new Date(userRecord.lockedUntil).getTime() > Date.now()) {
        const waitMin = Math.ceil(
          (new Date(userRecord.lockedUntil).getTime() - Date.now()) / 60000
        );
        return res.status(423).json({
          error: `Account temporarily locked due to multiple failed sign-in attempts. Try again in ${waitMin} minute(s).`,
        });
      }

      const validPassword = verifyPasswordScrypt(
        password,
        userRecord.passwordSalt,
        userRecord.passwordHash
      );

      if (!validPassword) {
        const attempts = (userRecord.failedLoginAttempts || 0) + 1;
        const lockUntil =
          attempts >= 5 ? new Date(Date.now() + 1000 * 60 * 15) : null;
        await db
          .update(users)
          .set({
            failedLoginAttempts: attempts,
            lockedUntil: lockUntil,
          })
          .where(eq(users.id, userRecord.id));

        return res.status(401).json({
          error: 'Invalid email address or password.',
        });
      }

      const effectiveRole = normalizeRole(userRecord.role, userRecord.email);

      const updatedUsers = await db
        .update(users)
        .set({
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
          role: effectiveRole,
        })
        .where(eq(users.id, userRecord.id))
        .returning();

      const updatedUser = updatedUsers[0];

      const session = await createAuthenticatedSession({
        userUid: updatedUser.uid,
        userEmail: updatedUser.email,
        userRole: effectiveRole,
        rememberMe: Boolean(rememberMe),
        ipAddress:
          (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
          req.socket.remoteAddress ||
          '',
        userAgent: req.headers['user-agent'] || '',
      });

      const maxAgeSec = Boolean(rememberMe) ? 60 * 60 * 24 * 30 : 60 * 60 * 12;
      res.setHeader(
        'Set-Cookie',
        `gs_session=${encodeURIComponent(
          session.rawSessionToken
        )}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${maxAgeSec}`
      );

      res.json({
        authenticated: true,
        sessionToken: session.rawSessionToken,
        csrfToken: session.csrfToken,
        expiresAt: session.expiresAt.toISOString(),
        user: sanitizeUserForClient(updatedUser),
        emailVerificationReminder: !updatedUser.emailVerified
          ? 'Your email address is not yet verified. Please verify your email to unlock full authenticated transactions.'
          : null,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Sign-in service temporarily unavailable.' });
    }
  });

  // 3e. Logout & Session Revocation
  app.post('/api/auth/logout', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const bearer =
        authHeader && authHeader.startsWith('Bearer ')
          ? authHeader.split('Bearer ')[1].trim()
          : '';
      if (bearer) {
        const tokenHash = hashOpaqueToken(bearer);
        await db.delete(authSessions).where(eq(authSessions.sessionTokenHash, tokenHash));
      }
      res.setHeader(
        'Set-Cookie',
        'gs_session=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0'
      );
      res.json({ loggedOut: true });
    } catch {
      res.json({ loggedOut: true });
    }
  });

  // 3f. Forgot Password (Anti-Enumeration Expiring Reset Token)
  app.post('/api/auth/forgot-password', rateLimitAuth(8, 60_000), async (req, res) => {
    try {
      const { email } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !isValidEmailFormat(cleanEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }

      const existing = await findUserByEmailCaseInsensitive(cleanEmail);
      if (existing) {
        const rawResetToken = generateSecureToken(24);
        const resetTokenHash = hashOpaqueToken(rawResetToken);
        const resetExpiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

        await db
          .update(users)
          .set({
            resetTokenHash,
            resetTokenExpiresAt: resetExpiresAt,
          })
          .where(eq(users.id, existing.id));

        const appBaseUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
        const resetLink = `${appBaseUrl}/?authAction=reset-password&token=${rawResetToken}`;

        await dispatchTransactionalAuthEmail({
          to: cleanEmail,
          subject: 'Galatasaray SK Official Platform · Password Reset Request',
          text: `A password reset was requested for your Galatasaray SK account. This link expires in 30 minutes:\n${resetLink}`,
          html: `<p>A password reset was requested for your <strong>Galatasaray SK</strong> account.</p><p>Click the link below within 30 minutes to set a new password:</p><p><a href="${resetLink}">${resetLink}</a></p>`,
        });
      }

      // Always return identical response to prevent account enumeration
      res.json({
        requested: true,
        message:
          'If an account is registered with that email address, a secure password reset link (valid for 30 minutes) has been dispatched.',
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Unable to process password reset request.' });
    }
  });

  // 3g. Reset Password with Expiring Token
  app.post('/api/auth/reset-password', rateLimitAuth(10, 60_000), async (req, res) => {
    try {
      const { token, newPassword, confirmPassword } = req.body || {};
      const cleanToken = String(token || '').trim();

      if (!cleanToken || !newPassword || !confirmPassword) {
        return res.status(400).json({
          error: 'Reset token, new password, and password confirmation are required.',
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match.' });
      }

      const strength = validatePasswordStrength(newPassword);
      if (!strength.valid) {
        return res.status(400).json({ error: strength.message });
      }

      const tokenHash = hashOpaqueToken(cleanToken);
      const matching = await db
        .select()
        .from(users)
        .where(eq(users.resetTokenHash, tokenHash));

      if (!matching.length) {
        return res.status(400).json({
          error: 'Invalid or already used password reset token.',
          code: 'INVALID_RESET_TOKEN',
        });
      }

      const targetUser = matching[0];
      if (
        !targetUser.resetTokenExpiresAt ||
        new Date(targetUser.resetTokenExpiresAt).getTime() <= Date.now()
      ) {
        return res.status(400).json({
          error: 'This password reset token has expired. Please request a new password reset.',
          code: 'EXPIRED_RESET_TOKEN',
        });
      }

      const { salt, hash } = hashPasswordScrypt(newPassword);
      await db
        .update(users)
        .set({
          passwordHash: hash,
          passwordSalt: salt,
          resetTokenHash: '',
          resetTokenExpiresAt: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        })
        .where(eq(users.id, targetUser.id));

      // Invalidate all existing sessions for security
      await db.delete(authSessions).where(eq(authSessions.userUid, targetUser.uid));

      res.json({
        reset: true,
        message: 'Your password has been securely updated. Please sign in with your new password.',
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Unable to reset password.' });
    }
  });

  // 4. Authenticated User Dashboard & Profile Sync
  app.get('/api/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || 'supporter@galatasaray.org';
      const name = req.user!.name || email.split('@')[0];
      const bundle = await getUserDashboardBundle(uid, email, name);
      res.json(bundle);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load supporter profile.' });
    }
  });

  app.put('/api/me/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const { fullName, phone, country, dateOfBirth, twoFactorEnabled } = req.body;
      const updated = await db
        .update(users)
        .set({
          fullName: fullName || 'Supporter',
          phone: phone || '',
          country: country || 'Turkey',
          dateOfBirth: dateOfBirth || '',
          twoFactorEnabled: Boolean(twoFactorEnabled),
        })
        .where(eq(users.uid, uid))
        .returning();

      res.json(sanitizeUserForClient(updated[0]));
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update profile settings.' });
    }
  });

  // ============================================================================
  // SERVER-SIDE PAYMENT INTENT & PAYPAL ORDER INITIALIZATION ENDPOINTS
  // ============================================================================

  app.post('/api/payments/stripe/create-intent', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { amountEur, purpose } = req.body;
      const result = await createStripeCheckoutPaymentIntent(Number(amountEur) || 50, {
        userUid: req.user!.uid,
        purpose: purpose || 'gsstore_checkout',
      });
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to initialize Stripe PaymentIntent.' });
    }
  });

  app.post('/api/payments/stripe/verify-intent', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { paymentIntentId, expectedAmountEur, orderNumber } = req.body;
      const verification = await verifyStripePaymentServerSide(
        paymentIntentId || '',
        Number(expectedAmountEur) || 0
      );
      if (!verification.verified) {
        return res.status(400).json({ verified: false, error: verification.error });
      }

      if (orderNumber) {
        const existingOrders = await db
          .select()
          .from(orders)
          .where(eq(orders.orderNumber, String(orderNumber).trim()));
        if (existingOrders.length > 0) {
          await db
            .update(orders)
            .set({ status: 'Paid', paymentIntentId: String(paymentIntentId).trim() })
            .where(eq(orders.orderNumber, String(orderNumber).trim()));
        }
      }

      res.json({ verified: true, status: 'succeeded' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to verify Stripe PaymentIntent server-side.' });
    }
  });

  app.post('/api/payments/paypal/create-order', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { amountEur, referenceId } = req.body;
      const result = await createPayPalOrderServerSide(
        Number(amountEur) || 50,
        referenceId || `GS-${Date.now()}`
      );
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to initialize PayPal REST API Order.' });
    }
  });

  app.post('/api/payments/paypal/capture-order', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { paypalOrderId, expectedAmountEur, orderNumber } = req.body;
      const result = await verifyAndCapturePayPalOrderServerSide(
        paypalOrderId || '',
        expectedAmountEur !== undefined ? Number(expectedAmountEur) : undefined
      );
      if (!result.verified) {
        return res.status(400).json({ verified: false, error: result.error });
      }

      if (orderNumber) {
        const existingOrders = await db
          .select()
          .from(orders)
          .where(eq(orders.orderNumber, String(orderNumber).trim()));
        if (existingOrders.length > 0) {
          await db
            .update(orders)
            .set({
              status: 'Paid',
              paymentIntentId: result.captureId || String(paypalOrderId).trim(),
            })
            .where(eq(orders.orderNumber, String(orderNumber).trim()));
        }
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to capture and verify PayPal REST API Order.' });
    }
  });

  app.get('/api/payments/paypal/verify-order/:paypalOrderId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const result = await getPayPalOrderServerSide(req.params.paypalOrderId);
      if (!result.verified) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to verify PayPal order status.' });
    }
  });

  // 5. Membership Purchase & Digital Card Issuance (Strict Server-Side Payment Verification)
  app.post(
    '/api/memberships/purchase',
    requireAuth,
    requireVerifiedUser,
    async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || 'supporter@galatasaray.org';
      const { tierCode, paymentProvider, paymentIntentId, paypalOrderId, fullName } = req.body;

      const tierRows = await db
        .select()
        .from(membershipTiers)
        .where(eq(membershipTiers.code, tierCode));
      if (!tierRows.length) {
        return res.status(400).json({ error: 'Selected membership tier does not exist.' });
      }
      const tier = tierRows[0];
      const feeAmount = Number(tier.annualFee);

      let targetStatus = 'Payment Pending';
      if (paymentProvider === 'Stripe') {
        const check = await verifyStripePaymentServerSide(paymentIntentId || '', feeAmount);
        if (!check.verified) {
          return res.status(400).json({
            error: check.error || 'Stripe payment could not be verified server-side. Membership cannot be marked Active without verified payment.',
          });
        }
        targetStatus = 'Active';
      } else if (paymentProvider === 'PayPal') {
        const check = await verifyAndCapturePayPalOrderServerSide(paypalOrderId || '', feeAmount);
        if (!check.verified) {
          return res.status(400).json({
            error: check.error || 'PayPal order capture could not be verified server-side.',
          });
        }
        targetStatus = 'Active';
      } else if (paymentProvider === 'Bank Transfer') {
        targetStatus = 'Pending Bank Wire Verification';
      } else {
        return res.status(400).json({ error: 'Unsupported payment provider.' });
      }

      const memberNumber = `GS-1905-${tierCode.slice(0, 3)}-${Math.floor(100000 + Math.random() * 900000)}`;
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      const expiryStr = expiryDate.toISOString().split('T')[0];

      await getOrCreateUser(uid, email, fullName);

      const updatedUser = await db
        .update(users)
        .set({
          fullName: fullName || req.user!.name || 'Galatasaray Member',
          membershipTier: tierCode,
          membershipNumber: memberNumber,
          membershipStatus: targetStatus,
          membershipExpiry: expiryStr,
        })
        .where(eq(users.uid, uid))
        .returning();

      await db.insert(notifications).values({
        userUid: uid,
        title: `${tier.name} Enrollment (${targetStatus})`,
        message: `Credential ID ${memberNumber} created with status "${targetStatus}".`,
        channel: 'In-Dashboard',
      });

      await logAdminAction(
        email,
        `Membership Enrollment (${targetStatus})`,
        `User ${email}`,
        'NONE',
        `${tierCode} (${memberNumber})`
      );

      res.json({
        user: updatedUser[0],
        tier,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to process membership enrollment.' });
    }
  });

  // 6. Meet & Greet Booking Endpoint (with Capacity Validation)
  app.post('/api/meet-bookings', requireAuth, requireVerifiedUser, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || 'supporter@galatasaray.org';
      const { sessionId, fanName, participants, specialRequest } = req.body;
      const numParticipants = Math.max(1, Number(participants) || 1);

      const sessionRows = await db
        .select()
        .from(meetSessions)
        .where(eq(meetSessions.id, Number(sessionId)));

      if (!sessionRows.length) {
        return res.status(404).json({ error: 'Selected Meet & Greet session not found.' });
      }
      const session = sessionRows[0];
      if (session.status !== 'Available' || session.bookedCount + numParticipants > session.capacity) {
        return res.status(400).json({
          error: 'This session does not have enough remaining capacity to prevent double booking.',
        });
      }

      const userRow = await getOrCreateUser(uid, email, fanName);
      const totalPaid = (Number(session.priceEur) * numParticipants).toFixed(2);
      const bookingRef = `GS-MEET-${Math.floor(100000 + Math.random() * 900000)}`;

      const newCount = session.bookedCount + numParticipants;
      await db
        .update(meetSessions)
        .set({
          bookedCount: newCount,
          status: newCount >= session.capacity ? 'Full' : 'Available',
        })
        .where(eq(meetSessions.id, session.id));

      const createdBooking = await db
        .insert(meetBookings)
        .values({
          bookingReference: bookingRef,
          sessionId: session.id,
          userUid: uid,
          fanName: fanName || userRow.fullName,
          fanEmail: email,
          participants: numParticipants,
          membershipTier: userRow.membershipTier,
          specialRequest: specialRequest || '',
          totalPaidEur: totalPaid,
          status: 'Payment Pending',
        })
        .returning();

      await db.insert(notifications).values({
        userUid: uid,
        title: `Meet the Stars Reservation Held: ${session.playerName}`,
        message: `Booking reference ${bookingRef} held for ${session.sessionDate} at ${session.sessionTime} (Status: Payment Pending).`,
        channel: 'In-Dashboard',
      });

      res.json(createdBooking[0]);
    } catch (error: any) {
      res.status(500).json({ error: 'Unable to complete Meet & Greet reservation.' });
    }
  });

  // 7. Football Academy Recruitment Application Endpoint
  app.post('/api/academy/apply', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || 'applicant@galatasaray.org';
      const {
        applicantName,
        dateOfBirth,
        nationality,
        country,
        currentClub,
        position,
        preferredFoot,
        heightCm,
        weightKg,
        playingLevel,
        experienceSummary,
        guardianName,
        phone,
        highlightVideoUrl,
        documentCvName,
        personalStatement,
      } = req.body;

      if (!applicantName || !dateOfBirth || !position || !personalStatement) {
        return res.status(400).json({ error: 'Please complete all required scouting application fields.' });
      }

      const appCode = `GS-ACAD-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const created = await db
        .insert(academyApplications)
        .values({
          applicationCode: appCode,
          userUid: uid,
          applicantName,
          dateOfBirth,
          nationality: nationality || 'Turkish',
          country: country || 'Turkey',
          currentClub: currentClub || 'Independent',
          position,
          preferredFoot: preferredFoot || 'Right',
          heightCm: Number(heightCm) || 175,
          weightKg: Number(weightKg) || 68,
          playingLevel: playingLevel || 'Youth Academy',
          experienceSummary: experienceSummary || 'Submitted via Global Portal',
          guardianName: guardianName || '',
          phone: phone || '',
          email,
          highlightVideoUrl: highlightVideoUrl || '',
          documentCvName: documentCvName || 'Player_Scouting_Dossier.pdf',
          medicalDeclaration: true,
          personalStatement,
          status: 'Submitted',
          scoutScore: 75,
          assignedScout: 'Florya International Scouting Desk',
        })
        .returning();

      await db.insert(notifications).values({
        userUid: uid,
        title: `Academy Dossier Received (${appCode})`,
        message: `Your scouting application for ${applicantName} (${position}) has been registered with the Florya Youth Development Directorate.`,
        channel: 'Portal',
      });

      res.json(created[0]);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to submit academy recruitment application.' });
    }
  });

  // 8. Live Auction Bidding Endpoint (with Server-Side Bid Validation)
  app.post(
    '/api/auctions/:id/bid',
    requireAuth,
    requireVerifiedUser,
    async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || 'collector@galatasaray.org';
      const auctionId = Number(req.params.id);
      const { bidAmountEur, bidderName } = req.body;

      const auctionRows = await db.select().from(auctions).where(eq(auctions.id, auctionId));
      if (!auctionRows.length) {
        return res.status(404).json({ error: 'Auction lot not found.' });
      }
      const auction = auctionRows[0];

      if (auction.status !== 'Open') {
        return res.status(400).json({ error: `This auction is currently ${auction.status}.` });
      }
      if (new Date(auction.endsAt).getTime() <= Date.now()) {
        return res.status(400).json({ error: 'This auction lot has already ended.' });
      }

      const minRequired = Number(auction.currentHighestBidEur) + Number(auction.bidIncrementEur);
      const numericBid = Number(bidAmountEur);

      if (isNaN(numericBid) || numericBid < minRequired) {
        return res.status(400).json({
          error: `Minimum valid bid is €${minRequired.toFixed(2)} (€${auction.bidIncrementEur} minimum increment).`,
        });
      }

      const displayBidder = bidderName || req.user!.name || email.split('@')[0];

      const updatedAuction = await db
        .update(auctions)
        .set({
          currentHighestBidEur: numericBid.toFixed(2),
          highestBidderUid: uid,
          highestBidderName: displayBidder,
          bidCount: auction.bidCount + 1,
        })
        .where(eq(auctions.id, auctionId))
        .returning();

      const bidRecord = await db
        .insert(auctionBids)
        .values({
          auctionId,
          userUid: uid,
          bidderName: displayBidder,
          bidAmountEur: numericBid.toFixed(2),
        })
        .returning();

      await db.insert(notifications).values({
        userUid: uid,
        title: `Highest Bidder Confirmed: ${auction.itemTitle}`,
        message: `Your official bid of €${numericBid.toFixed(2)} on Certificate ${auction.certificateNumber} is currently leading.`,
        channel: 'In-Dashboard',
      });

      res.json({
        auction: updatedAuction[0],
        bid: bidRecord[0],
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Unable to register bid.' });
    }
  });

  // 9. Store Checkout (Strict Server-Side Payment Verification - Never Simulate Paid Status)
  app.post(
    '/api/orders/checkout',
    requireAuth,
    requireVerifiedUser,
    async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || 'customer@galatasaray.org';
      const {
        customerName,
        shippingAddress,
        shippingCity,
        shippingCountry,
        shippingMethod,
        paymentProvider,
        paymentIntentId,
        paypalOrderId,
        discountCode,
        items,
      } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Your shopping bag is empty.' });
      }
      if (!customerName || !shippingAddress || !shippingCity || !shippingCountry) {
        return res.status(400).json({ error: 'Complete shipping address details are required.' });
      }

      let subtotal = 0;
      const validatedItems: Array<{ productId: number; name: string; size: string; qty: number; priceEur: number }> = [];

      for (const item of items) {
        const prodRows = await db.select().from(products).where(eq(products.id, Number(item.productId)));
        if (!prodRows.length) continue;
        const prod = prodRows[0];
        const qty = Math.max(1, Number(item.qty) || 1);
        const price = Number(prod.priceEur);
        subtotal += price * qty;
        validatedItems.push({
          productId: prod.id,
          name: prod.name,
          size: item.size || prod.sizes[0] || 'L',
          qty,
          priceEur: price,
        });
      }

      const shippingCost =
        shippingMethod === 'Express Priority' ? 24.0 : shippingMethod === 'Standard International' ? 14.0 : 8.0;
      const discount =
        discountCode && discountCode.trim().toUpperCase() === 'CIMBOM1905' ? subtotal * 0.1 : 0;
      const taxable = Math.max(0, subtotal - discount);
      const tax = taxable * 0.08;
      const total = taxable + tax + shippingCost;

      // Enforce strict server-side payment verification
      let verifiedOrderStatus = 'Pending';
      let verifiedPaymentRef = 'UNVERIFIED';

      if (paymentProvider === 'Stripe') {
        const verification = await verifyStripePaymentServerSide(paymentIntentId || '', total);
        if (!verification.verified) {
          return res.status(400).json({
            error: verification.error || 'Stripe payment could not be verified server-side.',
          });
        }
        verifiedOrderStatus = 'Paid';
        verifiedPaymentRef = paymentIntentId.trim();
      } else if (paymentProvider === 'PayPal') {
        const verification = await verifyAndCapturePayPalOrderServerSide(paypalOrderId || '', total);
        if (!verification.verified) {
          return res.status(400).json({
            error: verification.error || 'PayPal REST API order capture could not be verified server-side.',
          });
        }
        verifiedOrderStatus = 'Paid';
        verifiedPaymentRef = verification.captureId || paypalOrderId.trim();
      } else if (paymentProvider === 'Bank Transfer') {
        verifiedOrderStatus = 'Payment Pending (Bank Wire)';
        verifiedPaymentRef = `BANK-WIRE-${Date.now()}`;
      } else {
        return res.status(400).json({ error: 'Invalid payment provider selected.' });
      }

      // Deduct inventory now that order request is valid
      for (const vItem of validatedItems) {
        const prodRows = await db.select().from(products).where(eq(products.id, vItem.productId));
        if (prodRows.length) {
          await db
            .update(products)
            .set({ stockQuantity: Math.max(0, prodRows[0].stockQuantity - vItem.qty) })
            .where(eq(products.id, vItem.productId));
        }
      }

      const orderNumber = `GS-ORD-${Math.floor(100000 + Math.random() * 900000)}`;
      const trackingNumber = `GS-INTL-${Math.floor(10000000 + Math.random() * 89999999)}TR`;

      const estDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * (shippingMethod === 'Express Priority' ? 3 : 6))
        .toISOString()
        .split('T')[0];

      const createdOrder = await db
        .insert(orders)
        .values({
          orderNumber,
          userUid: uid,
          customerName,
          customerEmail: email,
          shippingAddress,
          shippingCity,
          shippingCountry,
          shippingMethod: shippingMethod || 'Express Priority',
          paymentProvider: paymentProvider || 'Bank Transfer',
          paymentIntentId: verifiedPaymentRef,
          items: validatedItems,
          subtotalEur: subtotal.toFixed(2),
          shippingCostEur: shippingCost.toFixed(2),
          taxEur: tax.toFixed(2),
          discountEur: discount.toFixed(2),
          totalEur: total.toFixed(2),
          status: verifiedOrderStatus,
          trackingNumber,
        })
        .returning();

      const initialShipmentStatus =
        verifiedOrderStatus === 'Paid' ? 'Payment Confirmed' : 'Order Received';

      const createdShipment = await db
        .insert(shipments)
        .values({
          trackingNumber,
          orderNumber,
          userUid: uid,
          recipientName: customerName,
          originFacility: 'Istanbul Global Logistics Hub (IST), Turkey',
          currentLocation: 'RAMS Park GSStore Fulfillment Center, Istanbul',
          destinationCity: shippingCity,
          destinationCountry: shippingCountry,
          courierProvider: 'Galatasaray Global Express (Internal Milestone Ledger)',
          serviceLevel: shippingMethod || 'Express Priority',
          weightKg: (0.45 * validatedItems.length).toFixed(2),
          dimensionsCm: '38x28x10 cm',
          estimatedDelivery: `${estDate} by 18:00 Local`,
          status: initialShipmentStatus,
          originLat: '41.0082',
          originLng: '28.9784',
          currentLat: '41.1031',
          currentLng: '28.9910',
          destLat: '48.8566',
          destLng: '2.3522',
          dataSourceMode: 'Admin Controlled Milestone',
        })
        .returning();

      await db.insert(trackingEvents).values([
        {
          trackingNumber,
          stage: initialShipmentStatus,
          facility: 'RAMS Park GSStore Fulfillment Center, Istanbul',
          description: `Order ${orderNumber} recorded with payment status "${verifiedOrderStatus}".`,
          eventTimestamp: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
        },
      ]);

      await db.insert(notifications).values({
        userUid: uid,
        title: `Order ${orderNumber} Registered (${verifiedOrderStatus})`,
        message: `Total €${total.toFixed(2)} (${paymentProvider}). Tracking reference: ${trackingNumber}.`,
        channel: 'In-Dashboard',
      });

      res.json({
        order: createdOrder[0],
        shipment: createdShipment[0],
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Checkout transaction could not be completed.' });
    }
  });

  // 10. Customer Support Ticket Submission
  app.post('/api/support/tickets', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || 'supporter@galatasaray.org';
      const { requesterName, category, subject, message, priority } = req.body;
      if (!subject || !message) {
        return res.status(400).json({ error: 'Subject and support message are required.' });
      }
      const ticketNumber = `GS-SUP-${Math.floor(10000 + Math.random() * 90000)}`;
      const created = await db
        .insert(supportTickets)
        .values({
          ticketNumber,
          userUid: uid,
          requesterName: requesterName || req.user!.name || 'Supporter',
          requesterEmail: email,
          category: category || 'Order Support',
          subject,
          message,
          priority: priority || 'Normal',
          status: 'Open',
        })
        .returning();

      res.json(created[0]);
    } catch (error: any) {
      res.status(500).json({ error: 'Unable to submit support ticket.' });
    }
  });

  // ============================================================================
  // GRANULAR ADMINISTRATOR CONTROL CENTER & INTEGRATION HEALTH ENDPOINTS
  // ============================================================================
  // Enforce strict backend Role-Based Access Control (ADMIN only) across all /api/admin/* routes
  app.use('/api/admin', requireAuth, requireAdmin);

  // Admin: Manage User Accounts (Role USER/ADMIN, Email Verification & Account Disabled Toggle)
  app.patch('/api/admin/users/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const targetId = Number(req.params.id);
      const { role, accountDisabled, emailVerified } = req.body || {};

      const existingRows = await db.select().from(users).where(eq(users.id, targetId));
      if (!existingRows.length) {
        return res.status(404).json({ error: 'User account not found.' });
      }
      const prev = existingRows[0];
      const nextRole =
        role !== undefined
          ? String(role).toUpperCase() === 'ADMIN'
            ? 'ADMIN'
            : 'USER'
          : prev.role;
      const nextDisabled =
        accountDisabled !== undefined ? Boolean(accountDisabled) : prev.accountDisabled;
      const nextVerified =
        emailVerified !== undefined ? Boolean(emailVerified) : prev.emailVerified;

      const updated = await db
        .update(users)
        .set({
          role: nextRole,
          accountDisabled: nextDisabled,
          emailVerified: nextVerified,
        })
        .where(eq(users.id, targetId))
        .returning();

      if (nextDisabled) {
        await db.delete(authSessions).where(eq(authSessions.userUid, prev.uid));
      }

      await logAdminAction(
        adminEmail,
        'Updated User Account Security / Role',
        prev.email,
        `Role=${prev.role}, Verified=${prev.emailVerified}, Disabled=${prev.accountDisabled}`,
        `Role=${nextRole}, Verified=${nextVerified}, Disabled=${nextDisabled}`
      );

      res.json(sanitizeUserForClient(updated[0]));
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update user account.' });
    }
  });

  app.get('/api/admin/overview', requireAuth, requireAdmin, async (_req: AuthRequest, res) => {
    try {
      const [bundle, integrations, matchCentre] = await Promise.all([
        getAdminOverviewBundle(),
        getAllIntegrationStatuses(),
        getMatchCentreBundle(),
      ]);
      res.json({
        ...bundle,
        integrations,
        matchCentre,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load admin overview.' });
    }
  });

  // Admin: Live Football Data Provider Sync & Configuration
  app.post('/api/admin/football-api/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const result = await syncLiveFootballDataFromProvider();
      await logAdminAction(
        adminEmail,
        'Triggered Live Football Data Provider Sync',
        'Football API Gateway',
        '',
        result.synced ? 'Synced' : result.error || 'Unavailable'
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Unable to execute Football API sync.' });
    }
  });

  app.put('/api/admin/football-api/config', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const cfg = await getOrCreateFootballApiConfig();
      const {
        provider,
        baseUrl,
        teamId,
        competitionIds,
        timezone,
        pollingIntervalSec,
        matchDayModeOverride,
      } = req.body || {};

      const updated = await db
        .update(footballApiConfigs)
        .set({
          provider: provider || cfg.provider,
          baseUrl: baseUrl || cfg.baseUrl,
          teamId: teamId || cfg.teamId,
          competitionIds: competitionIds || cfg.competitionIds,
          timezone: timezone || cfg.timezone,
          pollingIntervalSec: Number(pollingIntervalSec) || cfg.pollingIntervalSec,
          matchDayModeOverride:
            matchDayModeOverride !== undefined
              ? Boolean(matchDayModeOverride)
              : cfg.matchDayModeOverride,
          updatedAt: new Date(),
        })
        .where(eq(footballApiConfigs.id, cfg.id))
        .returning();

      await logAdminAction(
        adminEmail,
        'Updated Football API Provider Config',
        `Provider: ${updated[0].provider}`,
        '',
        `Team ${updated[0].teamId} · MatchDayOverride=${updated[0].matchDayModeOverride}`
      );
      res.json(updated[0]);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update Football API configuration.' });
    }
  });

  // Admin: Create, Update, Delete Match Fixtures & Timeline Events
  app.post('/api/admin/matches', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const {
        competition,
        season,
        homeTeam,
        awayTeam,
        opponent,
        venue,
        matchDate,
        kickoffTime,
        status,
        matchMinute,
        homeScore,
        awayScore,
        possessionPct,
        shotsTotal,
        shotsOnTarget,
        corners,
        fouls,
        offsides,
        yellowCards,
        redCards,
        attendance,
        referee,
      } = req.body;

      const created = await db
        .insert(matches)
        .values({
          competition: competition || 'Trendyol Süper Lig',
          season: season || '2026/27',
          homeTeam: homeTeam || 'Galatasaray SK',
          awayTeam: awayTeam || opponent || 'Opponent',
          opponent: opponent || awayTeam || 'Opponent',
          venue: venue || 'RAMS Park, Istanbul',
          matchDate: matchDate || new Date().toISOString().split('T')[0],
          kickoffTime: kickoffTime || '20:00 TRT',
          status: status || 'Upcoming',
          matchMinute: Number(matchMinute) || 0,
          homeScore: homeScore !== '' && homeScore !== null && homeScore !== undefined ? Number(homeScore) : null,
          awayScore: awayScore !== '' && awayScore !== null && awayScore !== undefined ? Number(awayScore) : null,
          possessionPct: Number(possessionPct) || 58,
          shotsTotal: Number(shotsTotal) || 16,
          shotsOnTarget: Number(shotsOnTarget) || 7,
          corners: Number(corners) || 6,
          fouls: Number(fouls) || 10,
          offsides: Number(offsides) || 2,
          yellowCards: Number(yellowCards) || 1,
          redCards: Number(redCards) || 0,
          attendance: Number(attendance) || 52800,
          referee: referee || 'UEFA / TFF Appointed Official',
          dataSource: 'Authorized Club Database',
          lastSyncedAt: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
          isDevSeed: false,
        })
        .returning();

      await logAdminAction(
        adminEmail,
        'Created Match Fixture',
        `Match vs ${created[0].opponent}`,
        '',
        `${created[0].matchDate} (${created[0].status})`
      );
      res.json(created[0]);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to create match fixture.' });
    }
  });

  app.patch('/api/admin/matches/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const id = Number(req.params.id);
      const existing = await db.select().from(matches).where(eq(matches.id, id));
      if (!existing.length) {
        return res.status(404).json({ error: 'Match not found.' });
      }
      const prev = existing[0];
      const {
        competition,
        opponent,
        venue,
        matchDate,
        kickoffTime,
        status,
        matchMinute,
        homeScore,
        awayScore,
        possessionPct,
        shotsTotal,
        shotsOnTarget,
        corners,
        fouls,
        offsides,
      } = req.body;

      const updated = await db
        .update(matches)
        .set({
          competition: competition ?? prev.competition,
          opponent: opponent ?? prev.opponent,
          venue: venue ?? prev.venue,
          matchDate: matchDate ?? prev.matchDate,
          kickoffTime: kickoffTime ?? prev.kickoffTime,
          status: status ?? prev.status,
          matchMinute: matchMinute !== undefined ? Number(matchMinute) : prev.matchMinute,
          homeScore:
            homeScore === '' || homeScore === null
              ? null
              : homeScore !== undefined
              ? Number(homeScore)
              : prev.homeScore,
          awayScore:
            awayScore === '' || awayScore === null
              ? null
              : awayScore !== undefined
              ? Number(awayScore)
              : prev.awayScore,
          possessionPct: possessionPct !== undefined ? Number(possessionPct) : prev.possessionPct,
          shotsTotal: shotsTotal !== undefined ? Number(shotsTotal) : prev.shotsTotal,
          shotsOnTarget: shotsOnTarget !== undefined ? Number(shotsOnTarget) : prev.shotsOnTarget,
          corners: corners !== undefined ? Number(corners) : prev.corners,
          fouls: fouls !== undefined ? Number(fouls) : prev.fouls,
          offsides: offsides !== undefined ? Number(offsides) : prev.offsides,
          lastSyncedAt: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
        })
        .where(eq(matches.id, id))
        .returning();

      await logAdminAction(
        adminEmail,
        'Updated Match Telemetry & Score',
        `Match #${id} vs ${prev.opponent}`,
        `${prev.status} (${prev.homeScore ?? '-'}:${prev.awayScore ?? '-'})`,
        `${updated[0].status} (${updated[0].homeScore ?? '-'}:${updated[0].awayScore ?? '-'})`
      );
      res.json(updated[0]);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update match fixture.' });
    }
  });

  app.delete('/api/admin/matches/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const id = Number(req.params.id);
      await db.delete(matchEvents).where(eq(matchEvents.matchId, id));
      await db.delete(matchLineups).where(eq(matchLineups.matchId, id));
      await db.delete(matches).where(eq(matches.id, id));
      await logAdminAction(adminEmail, 'Deleted Match Fixture', `Match ID #${id}`, 'Present', 'Deleted');
      res.json({ deleted: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete match fixture.' });
    }
  });

  app.post('/api/admin/matches/:id/events', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const matchId = Number(req.params.id);
      const { minute, addedTime, eventType, teamName, playerName, assistName, description } = req.body;
      const created = await db
        .insert(matchEvents)
        .values({
          matchId,
          minute: Number(minute) || 1,
          addedTime: Number(addedTime) || 0,
          eventType: eventType || 'GOAL',
          teamName: teamName || 'Galatasaray SK',
          playerName: playerName || 'Squad Player',
          assistName: assistName || '',
          description: description || 'Official match timeline event recorded.',
          isDevSeed: false,
        })
        .returning();

      await logAdminAction(
        adminEmail,
        'Added Match Timeline Event',
        `Match #${matchId}`,
        '',
        `${created[0].minute}' ${created[0].eventType} - ${created[0].playerName}`
      );
      res.json(created[0]);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to add match timeline event.' });
    }
  });

  // Admin: Inspect All Environment Variable & Integration Statuses (Never Exposes Secret Values)
  app.get('/api/admin/integrations/status', requireAuth, async (_req: AuthRequest, res) => {
    try {
      const statuses = await getAllIntegrationStatuses();
      res.json({ integrations: statuses });
    } catch (error: any) {
      res.status(500).json({ error: 'Unable to inspect integration environment variables.' });
    }
  });

  // Admin: Trigger Live Server-Side Integration Connection Test
  app.post('/api/admin/integrations/test/:provider', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const provider = req.params.provider.toLowerCase();
      const { testEmailRecipient } = req.body || {};

      let result;
      if (provider === 'stripe') {
        result = await testStripeIntegration();
      } else if (provider === 'paypal') {
        result = await testPayPalIntegration();
      } else if (provider === 'dhl') {
        result = await testDhlIntegration();
      } else if (provider === 'smtp') {
        result = await testSmtpIntegration(testEmailRecipient || adminEmail);
      } else {
        return res.status(400).json({ error: 'Unknown integration provider.' });
      }

      await logAdminAction(
        adminEmail,
        `Executed Server-Side Connection Test (${provider.toUpperCase()})`,
        `Integration: ${provider}`,
        '',
        result.connectionStatus
      );

      const allIntegrations = await getAllIntegrationStatuses();
      res.json({
        tested: result,
        integrations: allIntegrations,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Integration connection test failed unexpectedly.' });
    }
  });

  // Admin: Add or Update Player
  app.post('/api/admin/players', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const {
        name,
        squadNumber,
        position,
        category,
        nationality,
        appearances,
        goals,
        assists,
        biography,
        meetAndGreetAvailable,
      } = req.body;

      const created = await db
        .insert(players)
        .values({
          name,
          squadNumber: Number(squadNumber) || 99,
          position: position || 'Midfielder',
          category: category || 'First Team',
          nationality: nationality || 'Turkey',
          appearances: Number(appearances) || 1,
          goals: Number(goals) || 0,
          assists: Number(assists) || 0,
          minutesPlayed: 90,
          passAccuracy: 88,
          trophiesWon: 1,
          biography: biography || 'Official Galatasaray squad member.',
          imageUrl: '/src/assets/images/player_striker_portrait_1791538196754.jpg',
          meetAndGreetAvailable: Boolean(meetAndGreetAvailable),
          isDevSeed: false,
        })
        .returning();

      await logAdminAction(adminEmail, 'Created Player Profile', `Player: ${name} (#${squadNumber})`, '', 'Created');
      res.json(created[0]);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to create player profile.' });
    }
  });

  // Admin: Create Product
  app.post('/api/admin/products', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const { sku, name, category, description, priceEur, stockQuantity, condition } = req.body;
      const created = await db
        .insert(products)
        .values({
          sku: sku || `GS-SKU-${Date.now()}`,
          name,
          category: category || 'Official Jerseys',
          description: description || 'Authentic Galatasaray official club merchandise.',
          priceEur: Number(priceEur || 95).toFixed(2),
          stockQuantity: Number(stockQuantity) || 30,
          sizes: ['S', 'M', 'L', 'XL'],
          condition: condition || 'New Official',
          authenticityCode: `GS-AUTH-${Math.floor(100000 + Math.random() * 900000)}`,
          imageUrl: '/src/assets/images/product_official_home_kit_1791538209587.jpg',
          featured: true,
          isDevSeed: false,
        })
        .returning();

      await logAdminAction(adminEmail, 'Added Store Product', `SKU: ${created[0].sku}`, '', `€${created[0].priceEur}`);
      res.json(created[0]);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to create store product.' });
    }
  });

  // Admin: Create Auction Lot
  app.post('/api/admin/auctions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const {
        itemTitle,
        playerName,
        matchFixture,
        competition,
        startingPriceEur,
        reservePriceEur,
        bidIncrementEur,
        hoursDuration,
      } = req.body;

      const certNum = `GS-MW-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const endsAt = new Date(Date.now() + 1000 * 60 * 60 * (Number(hoursDuration) || 48));

      const created = await db
        .insert(auctions)
        .values({
          itemTitle,
          playerName,
          matchFixture: matchFixture || 'Galatasaray Home Fixture',
          competition: competition || 'UEFA Champions League',
          season: '2026/27',
          matchDate: new Date().toISOString().split('T')[0],
          itemCondition: 'Match-Worn & Hand-Signed with Hologram COA',
          certificateNumber: certNum,
          startingPriceEur: Number(startingPriceEur || 500).toFixed(2),
          reservePriceEur: Number(reservePriceEur || 1000).toFixed(2),
          bidIncrementEur: Number(bidIncrementEur || 50).toFixed(2),
          currentHighestBidEur: Number(startingPriceEur || 500).toFixed(2),
          highestBidderName: 'Opening Reserve',
          bidCount: 0,
          endsAt,
          status: 'Open',
          imageUrl: '/src/assets/images/auction_match_worn_shirt_1791538221590.jpg',
          isDevSeed: false,
        })
        .returning();

      await logAdminAction(adminEmail, 'Launched Match-Worn Auction', certNum, '', itemTitle);
      res.json(created[0]);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to launch auction.' });
    }
  });

  // Admin: Update Shipment Status & Add Tracking Event
  app.post('/api/admin/shipments/:trackingNumber/event', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const trackingNumber = req.params.trackingNumber.trim().toUpperCase();
      const { stage, facility, description, currentLat, currentLng } = req.body;

      const existing = await db.select().from(shipments).where(eq(shipments.trackingNumber, trackingNumber));
      if (!existing.length) {
        return res.status(404).json({ error: 'Shipment not found.' });
      }

      const prevStatus = existing[0].status;
      const updatedShipment = await db
        .update(shipments)
        .set({
          status: stage,
          currentLocation: facility,
          dataSourceMode: 'Admin Controlled Milestone',
          ...(currentLat ? { currentLat: String(currentLat) } : {}),
          ...(currentLng ? { currentLng: String(currentLng) } : {}),
          updatedAt: new Date(),
        })
        .where(eq(shipments.trackingNumber, trackingNumber))
        .returning();

      const createdEvent = await db
        .insert(trackingEvents)
        .values({
          trackingNumber,
          stage,
          facility,
          description: description || `Shipment milestone updated to ${stage} at ${facility}.`,
          eventTimestamp: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
        })
        .returning();

      await logAdminAction(
        adminEmail,
        'Updated Shipment Milestone',
        trackingNumber,
        prevStatus,
        `${stage} @ ${facility}`
      );

      res.json({
        shipment: updatedShipment[0],
        event: createdEvent[0],
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to append shipment tracking event.' });
    }
  });

  // Admin: Review Academy Application
  app.patch('/api/admin/academy/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const id = Number(req.params.id);
      const { status, scoutScore, assignedScout, internalNotes } = req.body;

      const existing = await db.select().from(academyApplications).where(eq(academyApplications.id, id));
      if (!existing.length) {
        return res.status(404).json({ error: 'Application not found.' });
      }

      const updated = await db
        .update(academyApplications)
        .set({
          status: status || existing[0].status,
          scoutScore: scoutScore !== undefined ? Number(scoutScore) : existing[0].scoutScore,
          assignedScout: assignedScout || existing[0].assignedScout,
          internalNotes: internalNotes !== undefined ? internalNotes : existing[0].internalNotes,
        })
        .where(eq(academyApplications.id, id))
        .returning();

      await logAdminAction(
        adminEmail,
        'Evaluated Academy Applicant',
        existing[0].applicationCode,
        existing[0].status,
        `${status} (Score: ${scoutScore})`
      );

      res.json(updated[0]);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update academy application.' });
    }
  });

  // Admin: Create CMS Article
  app.post('/api/admin/articles', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const { title, category, summary, body, status, metaTitle, metaDescription } = req.body;
      const slug =
        (title || 'club-announcement')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') +
        '-' +
        Math.floor(100 + Math.random() * 900);

      const created = await db
        .insert(cmsArticles)
        .values({
          slug,
          title,
          category: category || 'News',
          summary: summary || '',
          body: body || '',
          status: status || 'Published',
          metaTitle: metaTitle || `${title} | Galatasaray SK`,
          metaDescription: metaDescription || summary || '',
          publishedAt: new Date().toISOString().split('T')[0],
          isDevSeed: false,
        })
        .returning();

      await logAdminAction(adminEmail, 'Published CMS Article', slug, '', title);
      res.json(created[0]);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to publish article.' });
    }
  });

  // Admin: Update or Delete CMS Article
  app.patch('/api/admin/articles/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const id = Number(req.params.id);
      const { status, title, category, summary, body } = req.body;
      const existing = await db.select().from(cmsArticles).where(eq(cmsArticles.id, id));
      if (!existing.length) return res.status(404).json({ error: 'Article not found.' });
      const prev = existing[0];
      const updated = await db
        .update(cmsArticles)
        .set({
          status: status ?? prev.status,
          title: title ?? prev.title,
          category: category ?? prev.category,
          summary: summary ?? prev.summary,
          body: body ?? prev.body,
        })
        .where(eq(cmsArticles.id, id))
        .returning();
      await logAdminAction(adminEmail, 'Updated CMS Article', prev.slug, prev.status, updated[0].status);
      res.json(updated[0]);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update CMS article.' });
    }
  });

  app.delete('/api/admin/articles/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const id = Number(req.params.id);
      await db.delete(cmsArticles).where(eq(cmsArticles.id, id));
      await logAdminAction(adminEmail, 'Deleted CMS Article', `Article #${id}`, 'Published', 'Deleted');
      res.json({ deleted: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete CMS article.' });
    }
  });

  app.delete('/api/admin/players/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const id = Number(req.params.id);
      await db.delete(players).where(eq(players.id, id));
      await logAdminAction(adminEmail, 'Deleted Player Profile', `Player #${id}`, 'Active', 'Deleted');
      res.json({ deleted: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete player profile.' });
    }
  });

  app.delete('/api/admin/products/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const id = Number(req.params.id);
      await db.delete(products).where(eq(products.id, id));
      await logAdminAction(adminEmail, 'Deleted Store Product', `Product #${id}`, 'Active', 'Deleted');
      res.json({ deleted: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete store product.' });
    }
  });

  app.patch('/api/admin/auctions/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const id = Number(req.params.id);
      const { status } = req.body;
      const updated = await db
        .update(auctions)
        .set({ status: status || 'Closed' })
        .where(eq(auctions.id, id))
        .returning();
      await logAdminAction(adminEmail, 'Updated Auction Status', `Auction #${id}`, '', status || 'Closed');
      res.json(updated[0]);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update auction status.' });
    }
  });

  app.delete('/api/admin/auctions/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const id = Number(req.params.id);
      await db.delete(auctionBids).where(eq(auctionBids.auctionId, id));
      await db.delete(auctions).where(eq(auctions.id, id));
      await logAdminAction(adminEmail, 'Deleted Auction Lot', `Auction #${id}`, 'Active', 'Deleted');
      res.json({ deleted: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete auction lot.' });
    }
  });

  // Admin: Update Order Status
  app.patch('/api/admin/orders/:id/status', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const id = Number(req.params.id);
      const { status } = req.body;

      const existing = await db.select().from(orders).where(eq(orders.id, id));
      if (!existing.length) {
        return res.status(404).json({ error: 'Order not found.' });
      }

      const prevStatus = existing[0].status;
      const updated = await db
        .update(orders)
        .set({ status: status || prevStatus })
        .where(eq(orders.id, id))
        .returning();

      await logAdminAction(
        adminEmail,
        'Updated Order Lifecycle Status',
        existing[0].orderNumber,
        prevStatus,
        status || prevStatus
      );

      res.json(updated[0]);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update order status.' });
    }
  });

  // Admin: Reply & Update Support Ticket
  app.patch('/api/admin/support/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const id = Number(req.params.id);
      const { status, adminReply } = req.body;

      const updated = await db
        .update(supportTickets)
        .set({
          status: status || 'Resolved',
          adminReply: adminReply || '',
        })
        .where(eq(supportTickets.id, id))
        .returning();

      await logAdminAction(
        adminEmail,
        'Updated Support Ticket',
        updated[0]?.ticketNumber || String(id),
        '',
        status || 'Resolved'
      );
      res.json(updated[0]);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update support ticket.' });
    }
  });

  // Admin: Update Site Configuration
  app.post('/api/admin/config', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      const { configKey, configValue, category } = req.body;
      const updated = await db
        .insert(siteConfigurations)
        .values({
          configKey,
          configValue,
          category: category || 'Brand',
        })
        .onConflictDoUpdate({
          target: siteConfigurations.configKey,
          set: { configValue, updatedAt: new Date() },
        })
        .returning();

      await logAdminAction(adminEmail, 'Updated Platform Configuration', configKey, '', configValue);
      res.json(updated[0]);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update site configuration.' });
    }
  });

  // Admin: Demo Data Policy - Purge Development Seed Records
  app.delete('/api/admin/dev-seed', requireAuth, async (req: AuthRequest, res) => {
    try {
      const adminEmail = req.user!.email || 'admin@galatasaray.org';
      await db.delete(players).where(eq(players.isDevSeed, true));
      await db.delete(matches).where(eq(matches.isDevSeed, true));
      await db.delete(meetSessions).where(eq(meetSessions.isDevSeed, true));
      await db.delete(products).where(eq(products.isDevSeed, true));
      await db.delete(auctions).where(eq(auctions.isDevSeed, true));
      await db.delete(academyApplications).where(eq(academyApplications.isDevSeed, true));
      await db.delete(cmsArticles).where(eq(cmsArticles.isDevSeed, true));

      await logAdminAction(
        adminEmail,
        'Purged Development Seed Records',
        'All Seed Entities (isDevSeed=true)',
        'Seeded',
        'Production Clean'
      );

      res.json({ purged: true });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to purge development seed data.' });
    }
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Galatasaray Digital Platform Server running on http://localhost:${PORT}`);
  });
}

startServer();
