import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { authSessions, users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { hashOpaqueToken, normalizeRole } from '../lib/authService.ts';

export interface AuthenticatedActor {
  uid: string;
  email: string;
  name?: string;
  role: 'ADMIN' | 'USER';
  emailVerified: boolean;
  authMethod: 'session' | 'firebase';
  csrfToken?: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedActor;
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const k = pair.slice(0, idx).trim();
      const v = decodeURIComponent(pair.slice(idx + 1).trim());
      out[k] = v;
    }
  }
  return out;
}

// In-memory sliding window rate limiter for authentication & sensitive endpoints
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

export const rateLimitAuth = (maxRequests = 15, windowMs = 60_000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'local';
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    const existing = rateLimitBuckets.get(key);

    if (!existing || existing.resetAt <= now) {
      rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    existing.count += 1;
    if (existing.count > maxRequests) {
      const retrySec = Math.ceil((existing.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retrySec));
      return res.status(429).json({
        error: `Too many authentication requests. Please wait ${retrySec} seconds before retrying.`,
      });
    }
    return next();
  };
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const cookies = parseCookies(req.headers.cookie);
  const bearerToken =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split('Bearer ')[1].trim()
      : '';
  const rawToken = bearerToken || cookies['gs_session'] || '';

  if (!rawToken) {
    return res
      .status(401)
      .json({ error: 'Authentication required. Please sign in to access this resource.' });
  }

  // 1. Check PostgreSQL auth_sessions table first (Email/Password Session Token)
  try {
    const tokenHash = hashOpaqueToken(rawToken);
    const sessionRows = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.sessionTokenHash, tokenHash));

    if (sessionRows.length > 0) {
      const sess = sessionRows[0];
      if (new Date(sess.expiresAt).getTime() <= Date.now()) {
        await db.delete(authSessions).where(eq(authSessions.id, sess.id));
        return res
          .status(401)
          .json({ error: 'Your session has expired. Please sign in again.' });
      }

      const userRows = await db
        .select()
        .from(users)
        .where(eq(users.uid, sess.userUid));

      if (!userRows.length) {
        return res.status(401).json({ error: 'User account record not found.' });
      }
      const dbUser = userRows[0];
      if (dbUser.accountDisabled) {
        return res.status(403).json({
          error: 'Your account has been disabled by an administrator. Contact club support.',
        });
      }

      // Optional CSRF header check if cookie-only auth is used on state-changing requests
      if (
        !bearerToken &&
        cookies['gs_session'] &&
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
      ) {
        const clientCsrf = req.headers['x-csrf-token'];
        if (clientCsrf && clientCsrf !== sess.csrfToken) {
          return res.status(403).json({ error: 'Invalid CSRF security token.' });
        }
      }

      const effectiveRole = normalizeRole(dbUser.role, dbUser.email);
      req.user = {
        uid: dbUser.uid,
        email: dbUser.email,
        name: dbUser.fullName,
        role: effectiveRole,
        emailVerified: dbUser.emailVerified,
        authMethod: 'session',
        csrfToken: sess.csrfToken,
      };
      return next();
    }
  } catch (err) {
    console.error('Session lookup error:', err);
  }

  // 2. Fallback: Verify Firebase ID Token (Google Sign-In)
  try {
    const decoded = await adminAuth.verifyIdToken(rawToken);
    const email = decoded.email || 'supporter@galatasaray.org';
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.uid, decoded.uid));

    let dbUser = userRows[0];
    const effectiveRole = normalizeRole(dbUser?.role, email);

    if (dbUser?.accountDisabled) {
      return res.status(403).json({
        error: 'Your account has been disabled by an administrator.',
      });
    }

    req.user = {
      uid: decoded.uid,
      email,
      name: dbUser?.fullName || decoded.name || email.split('@')[0],
      role: effectiveRole,
      emailVerified: Boolean(decoded.email_verified ?? true),
      authMethod: 'firebase',
    };
    return next();
  } catch (error) {
    return res
      .status(401)
      .json({ error: 'Session expired or invalid authentication token. Please sign in again.' });
  }
};

export const requireVerifiedUser = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (!req.user.emailVerified && req.user.role !== 'ADMIN') {
    return res.status(403).json({
      error:
        'Email verification required. Please verify your email address before performing this action.',
      code: 'EMAIL_VERIFICATION_REQUIRED',
    });
  }
  return next();
};

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      error:
        'Access Denied (HTTP 403): Administrator role (ADMIN) is required to access the Admin Console or administrative API endpoints.',
      code: 'ADMIN_ROLE_REQUIRED',
    });
  }
  return next();
};
