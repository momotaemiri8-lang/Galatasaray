import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import { db } from '../db/index.ts';
import { integrationStatuses } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export interface EnvVarPresence {
  name: string;
  present: boolean;
  required: boolean;
  description: string;
}

export interface IntegrationDescriptor {
  provider: 'stripe' | 'paypal' | 'dhl' | 'smtp';
  title: string;
  environmentMode: string;
  endpointUrl: string;
  variables: EnvVarPresence[];
  allRequiredPresent: boolean;
  connectionStatus: 'Operational' | 'Configuration Warning' | 'Connection Failed' | 'Not Tested';
  lastSuccessfulTestAt: string;
  lastAttemptAt: string;
  safeErrorDescription: string;
  approvalRequirement: string;
  setupInstructions: string[];
}

function isRealSecretPresent(envName: string): boolean {
  const raw = process.env[envName];
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower.includes('placeholder') ||
    lower === 'my_gemini_api_key' ||
    lower === 'my_app_url' ||
    lower === 'changeme' ||
    lower === 'your_key_here'
  ) {
    return false;
  }
  return true;
}

export function sanitizeProviderError(rawMessage: string): string {
  if (!rawMessage) return 'Unknown connection error occurred.';
  let msg = rawMessage;
  const secretEnvNames = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'PAYPAL_CLIENT_ID',
    'PAYPAL_CLIENT_SECRET',
    'DHL_EXPRESS_API_KEY',
    'DHL_EXPRESS_API_SECRET',
    'DHL_EXPRESS_ACCOUNT_NUMBER',
    'SMTP_TRANSACTIONAL_USER',
    'SMTP_TRANSACTIONAL_PASS',
  ];
  for (const envKey of secretEnvNames) {
    const val = process.env[envKey];
    if (val && val.trim().length > 3) {
      msg = msg.split(val.trim()).join('[REDACTED]');
    }
  }
  msg = msg.replace(/sk_(test|live)_[a-zA-Z0-9]+/g, 'sk_[REDACTED]');
  msg = msg.replace(/whsec_[a-zA-Z0-9]+/g, 'whsec_[REDACTED]');
  return msg.slice(0, 260);
}

async function upsertIntegrationRecord(
  provider: 'stripe' | 'paypal' | 'dhl' | 'smtp',
  environmentMode: string,
  connectionStatus: 'Operational' | 'Configuration Warning' | 'Connection Failed' | 'Not Tested',
  safeErrorDescription: string,
  markSuccess: boolean
) {
  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  try {
    const existing = await db
      .select()
      .from(integrationStatuses)
      .where(eq(integrationStatuses.provider, provider));

    const lastSuccess = markSuccess
      ? nowStr
      : existing[0]?.lastSuccessfulTestAt || '';

    await db
      .insert(integrationStatuses)
      .values({
        provider,
        environmentMode,
        connectionStatus,
        lastSuccessfulTestAt: lastSuccess,
        lastAttemptAt: nowStr,
        safeErrorDescription,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: integrationStatuses.provider,
        set: {
          environmentMode,
          connectionStatus,
          lastSuccessfulTestAt: lastSuccess,
          lastAttemptAt: nowStr,
          safeErrorDescription,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    console.error('Failed to persist integration status record');
  }
}

export async function getAllIntegrationStatuses(): Promise<IntegrationDescriptor[]> {
  let storedRows: Array<typeof integrationStatuses.$inferSelect> = [];
  try {
    storedRows = await db.select().from(integrationStatuses);
  } catch {
    storedRows = [];
  }

  const byProvider = new Map(storedRows.map((r) => [r.provider, r]));

  // 1. STRIPE
  const stripeVars: EnvVarPresence[] = [
    {
      name: 'STRIPE_SECRET_KEY',
      present: isRealSecretPresent('STRIPE_SECRET_KEY'),
      required: true,
      description: 'Stripe Server-Side Secret API Key (sk_test_... or sk_live_...)',
    },
    {
      name: 'STRIPE_WEBHOOK_SECRET',
      present: isRealSecretPresent('STRIPE_WEBHOOK_SECRET'),
      required: true,
      description: 'Stripe Webhook Endpoint Signing Secret (whsec_...)',
    },
  ];
  const stripeAllPresent = stripeVars.filter((v) => v.required).every((v) => v.present);
  const stripeMode =
    process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test';
  const stripeStored = byProvider.get('stripe');

  // 2. PAYPAL REST API
  const paypalEnvRaw = (process.env.PAYPAL_ENVIRONMENT || 'sandbox').toLowerCase();
  const paypalMode = paypalEnvRaw === 'live' || paypalEnvRaw === 'production' ? 'live' : 'sandbox';
  const paypalEndpoint =
    paypalMode === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  const paypalVars: EnvVarPresence[] = [
    {
      name: 'PAYPAL_CLIENT_ID',
      present: isRealSecretPresent('PAYPAL_CLIENT_ID'),
      required: true,
      description: 'PayPal REST API App Client ID',
    },
    {
      name: 'PAYPAL_CLIENT_SECRET',
      present: isRealSecretPresent('PAYPAL_CLIENT_SECRET'),
      required: true,
      description: 'PayPal REST API App Secret (Server-Side Only)',
    },
    {
      name: 'PAYPAL_ENVIRONMENT',
      present: Boolean(process.env.PAYPAL_ENVIRONMENT),
      required: false,
      description: 'PayPal Environment Mode ("sandbox" or "live", defaults to "sandbox")',
    },
  ];
  const paypalAllPresent = paypalVars.filter((v) => v.required).every((v) => v.present);
  const paypalStored = byProvider.get('paypal');

  // 3. DHL EXPRESS MYDHL API
  const dhlEnvRaw = (process.env.DHL_EXPRESS_ENVIRONMENT || 'test').toLowerCase();
  const dhlMode = dhlEnvRaw === 'production' || dhlEnvRaw === 'live' ? 'production' : 'test';
  const dhlEndpoint =
    dhlMode === 'production'
      ? 'https://express.api.dhl.com/mydhlapi'
      : 'https://express.api.dhl.com/mydhlapi/test';
  const dhlVars: EnvVarPresence[] = [
    {
      name: 'DHL_EXPRESS_API_KEY',
      present: isRealSecretPresent('DHL_EXPRESS_API_KEY'),
      required: true,
      description: 'MyDHL API Basic Auth Username / API Key',
    },
    {
      name: 'DHL_EXPRESS_API_SECRET',
      present: isRealSecretPresent('DHL_EXPRESS_API_SECRET'),
      required: true,
      description: 'MyDHL API Basic Auth Password / API Secret',
    },
    {
      name: 'DHL_EXPRESS_ACCOUNT_NUMBER',
      present: isRealSecretPresent('DHL_EXPRESS_ACCOUNT_NUMBER'),
      required: true,
      description: '9-Digit DHL Express Shipper Account Number',
    },
    {
      name: 'DHL_EXPRESS_ENVIRONMENT',
      present: Boolean(process.env.DHL_EXPRESS_ENVIRONMENT),
      required: false,
      description: 'MyDHL API Target Environment ("test" or "production", defaults to "test")',
    },
  ];
  const dhlAllPresent = dhlVars.filter((v) => v.required).every((v) => v.present);
  const dhlStored = byProvider.get('dhl');

  // 4. TRANSACTIONAL EMAIL (SMTP)
  const smtpHost = process.env.SMTP_TRANSACTIONAL_HOST || '';
  const smtpPort = process.env.SMTP_TRANSACTIONAL_PORT || '587';
  const smtpVars: EnvVarPresence[] = [
    {
      name: 'SMTP_TRANSACTIONAL_HOST',
      present: isRealSecretPresent('SMTP_TRANSACTIONAL_HOST'),
      required: true,
      description: 'Transactional SMTP Server Hostname (e.g. smtp.sendgrid.net, email-smtp.eu-west-1.amazonaws.com)',
    },
    {
      name: 'SMTP_TRANSACTIONAL_PORT',
      present: isRealSecretPresent('SMTP_TRANSACTIONAL_PORT'),
      required: true,
      description: 'SMTP Port (587 for STARTTLS or 465 for implicit TLS)',
    },
    {
      name: 'SMTP_TRANSACTIONAL_USER',
      present: isRealSecretPresent('SMTP_TRANSACTIONAL_USER'),
      required: true,
      description: 'SMTP Authentication Username',
    },
    {
      name: 'SMTP_TRANSACTIONAL_PASS',
      present: isRealSecretPresent('SMTP_TRANSACTIONAL_PASS'),
      required: true,
      description: 'SMTP Authentication Password / API Token',
    },
    {
      name: 'SMTP_FROM_EMAIL',
      present: isRealSecretPresent('SMTP_FROM_EMAIL'),
      required: false,
      description: 'Verified Sender Email Address (defaults to no-reply@galatasaray.org)',
    },
  ];
  const smtpAllPresent = smtpVars.filter((v) => v.required).every((v) => v.present);
  const smtpStored = byProvider.get('smtp');

  const resolveStatus = (
    allPresent: boolean,
    stored?: typeof integrationStatuses.$inferSelect
  ): 'Operational' | 'Configuration Warning' | 'Connection Failed' | 'Not Tested' => {
    if (!allPresent) return 'Configuration Warning';
    if (!stored) return 'Not Tested';
    if (stored.connectionStatus === 'Operational') return 'Operational';
    if (stored.connectionStatus === 'Connection Failed') return 'Connection Failed';
    return 'Not Tested';
  };

  return [
    {
      provider: 'stripe',
      title: 'Stripe Payments & Webhook Engine',
      environmentMode: stripeMode,
      endpointUrl: 'https://api.stripe.com/v1',
      variables: stripeVars,
      allRequiredPresent: stripeAllPresent,
      connectionStatus: resolveStatus(stripeAllPresent, stripeStored),
      lastSuccessfulTestAt: stripeStored?.lastSuccessfulTestAt || '',
      lastAttemptAt: stripeStored?.lastAttemptAt || '',
      safeErrorDescription: !stripeAllPresent
        ? 'Missing required STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET in Secrets panel.'
        : stripeStored?.safeErrorDescription || '',
      approvalRequirement:
        'Live mode requires Stripe business identity & KYB verification in the Stripe Dashboard.',
      setupInstructions: [
        'Sign in to https://dashboard.stripe.com/apikeys.',
        'Copy your Secret Key (sk_test_... or sk_live_...) into STRIPE_SECRET_KEY in the AI Studio Secrets panel.',
        'Go to Developers → Webhooks → Add Endpoint pointing to <APP_URL>/api/webhooks/stripe for payment_intent.succeeded events.',
        'Copy the Signing Secret (whsec_...) into STRIPE_WEBHOOK_SECRET.',
      ],
    },
    {
      provider: 'paypal',
      title: 'PayPal REST API v2 Orders & Capture',
      environmentMode: paypalMode,
      endpointUrl: paypalEndpoint,
      variables: paypalVars,
      allRequiredPresent: paypalAllPresent,
      connectionStatus: resolveStatus(paypalAllPresent, paypalStored),
      lastSuccessfulTestAt: paypalStored?.lastSuccessfulTestAt || '',
      lastAttemptAt: paypalStored?.lastAttemptAt || '',
      safeErrorDescription: !paypalAllPresent
        ? 'Missing required PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET in Secrets panel.'
        : paypalStored?.safeErrorDescription || '',
      approvalRequirement:
        'Moving from Sandbox to Live requires a verified PayPal Business account with REST API Live credentials enabled.',
      setupInstructions: [
        'Sign in to https://developer.paypal.com/dashboard/applications.',
        'Select Sandbox or Live and create a REST API App.',
        'Copy Client ID into PAYPAL_CLIENT_ID and Secret into PAYPAL_CLIENT_SECRET in the Secrets panel.',
        'Set PAYPAL_ENVIRONMENT to "sandbox" or "live".',
      ],
    },
    {
      provider: 'dhl',
      title: 'DHL Express MyDHL API (Tracking & Airway Bills)',
      environmentMode: dhlMode,
      endpointUrl: dhlEndpoint,
      variables: dhlVars,
      allRequiredPresent: dhlAllPresent,
      connectionStatus: resolveStatus(dhlAllPresent, dhlStored),
      lastSuccessfulTestAt: dhlStored?.lastSuccessfulTestAt || '',
      lastAttemptAt: dhlStored?.lastAttemptAt || '',
      safeErrorDescription: !dhlAllPresent
        ? 'Missing required DHL_EXPRESS_API_KEY, DHL_EXPRESS_API_SECRET, or DHL_EXPRESS_ACCOUNT_NUMBER in Secrets panel.'
        : dhlStored?.safeErrorDescription || '',
      approvalRequirement:
        'Requires DHL Express Developer Portal app approval and an active 9-digit DHL Express shipper account number.',
      setupInstructions: [
        'Register at https://developer.dhl.com and request access to "MyDHL API (DHL Express)".',
        'Once approved, copy the App Key (Username) into DHL_EXPRESS_API_KEY and App Secret (Password) into DHL_EXPRESS_API_SECRET.',
        'Provide your 9-digit shipper number in DHL_EXPRESS_ACCOUNT_NUMBER and set DHL_EXPRESS_ENVIRONMENT to "test" or "production".',
      ],
    },
    {
      provider: 'smtp',
      title: 'Transactional Email Service (SMTP)',
      environmentMode: smtpPort === '465' ? 'TLS-465' : 'STARTTLS-587',
      endpointUrl: smtpHost ? `smtp://${smtpHost}:${smtpPort}` : 'Unconfigured SMTP Host',
      variables: smtpVars,
      allRequiredPresent: smtpAllPresent,
      connectionStatus: resolveStatus(smtpAllPresent, smtpStored),
      lastSuccessfulTestAt: smtpStored?.lastSuccessfulTestAt || '',
      lastAttemptAt: smtpStored?.lastAttemptAt || '',
      safeErrorDescription: !smtpAllPresent
        ? 'Missing required SMTP_TRANSACTIONAL_HOST, SMTP_TRANSACTIONAL_PORT, SMTP_TRANSACTIONAL_USER, or SMTP_TRANSACTIONAL_PASS.'
        : smtpStored?.safeErrorDescription || '',
      approvalRequirement:
        'Production delivery requires SPF, DKIM, and DMARC DNS verification on your sender domain.',
      setupInstructions: [
        'Create an SMTP credential in your transactional email provider (AWS SES, SendGrid, Postmark, or Mailgun).',
        'Set SMTP_TRANSACTIONAL_HOST, SMTP_TRANSACTIONAL_PORT (587 or 465), SMTP_TRANSACTIONAL_USER, and SMTP_TRANSACTIONAL_PASS.',
        'Set SMTP_FROM_EMAIL to your verified domain sender address.',
      ],
    },
  ];
}

// ============================================================================
// LIVE SERVER-SIDE CONNECTION TESTS (NO SIMULATION OR MOCK FALLBACKS)
// ============================================================================

export async function testStripeIntegration(): Promise<IntegrationDescriptor> {
  const stripeMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test';
  if (!isRealSecretPresent('STRIPE_SECRET_KEY') || !isRealSecretPresent('STRIPE_WEBHOOK_SECRET')) {
    await upsertIntegrationRecord(
      'stripe',
      stripeMode,
      'Configuration Warning',
      'Configuration Warning: STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must both be set before testing.',
      false
    );
    const all = await getAllIntegrationStatuses();
    return all.find((i) => i.provider === 'stripe')!;
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!.trim());
    // Perform real server-side balance retrieve call to verify API key validity
    const balance = await stripe.balance.retrieve();
    const livemodeStr = balance.livemode ? 'Live Mode' : 'Test Mode';
    await upsertIntegrationRecord(
      'stripe',
      balance.livemode ? 'live' : 'test',
      'Operational',
      `Verified Stripe API connectivity (${livemodeStr}) and webhook signing secret presence.`,
      true
    );
  } catch (err: any) {
    const safeMsg = sanitizeProviderError(err?.message || 'Stripe API authentication failed.');
    await upsertIntegrationRecord('stripe', stripeMode, 'Connection Failed', safeMsg, false);
  }

  const all = await getAllIntegrationStatuses();
  return all.find((i) => i.provider === 'stripe')!;
}

export async function getPayPalAccessToken(): Promise<{ accessToken: string; baseUrl: string; mode: string }> {
  if (!isRealSecretPresent('PAYPAL_CLIENT_ID') || !isRealSecretPresent('PAYPAL_CLIENT_SECRET')) {
    throw new Error('PayPal credentials (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET) are not configured.');
  }
  const envRaw = (process.env.PAYPAL_ENVIRONMENT || 'sandbox').toLowerCase();
  const mode = envRaw === 'live' || envRaw === 'production' ? 'live' : 'sandbox';
  const baseUrl =
    mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

  const authBuffer = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID!.trim()}:${process.env.PAYPAL_CLIENT_SECRET!.trim()}`
  ).toString('base64');

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authBuffer}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PayPal OAuth2 token exchange failed (HTTP ${response.status}): ${text.slice(0, 120)}`);
  }

  const data = (await response.json()) as { access_token: string };
  if (!data.access_token) {
    throw new Error('PayPal OAuth2 response did not contain an access_token.');
  }

  return { accessToken: data.access_token, baseUrl, mode };
}

export async function testPayPalIntegration(): Promise<IntegrationDescriptor> {
  const envRaw = (process.env.PAYPAL_ENVIRONMENT || 'sandbox').toLowerCase();
  const mode = envRaw === 'live' || envRaw === 'production' ? 'live' : 'sandbox';

  if (!isRealSecretPresent('PAYPAL_CLIENT_ID') || !isRealSecretPresent('PAYPAL_CLIENT_SECRET')) {
    await upsertIntegrationRecord(
      'paypal',
      mode,
      'Configuration Warning',
      'Configuration Warning: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be configured.',
      false
    );
    const all = await getAllIntegrationStatuses();
    return all.find((i) => i.provider === 'paypal')!;
  }

  try {
    const { mode: verifiedMode, baseUrl } = await getPayPalAccessToken();
    await upsertIntegrationRecord(
      'paypal',
      verifiedMode,
      'Operational',
      `OAuth 2.0 client_credentials token verified against ${baseUrl}.`,
      true
    );
  } catch (err: any) {
    const safeMsg = sanitizeProviderError(err?.message || 'PayPal REST API handshake failed.');
    await upsertIntegrationRecord('paypal', mode, 'Connection Failed', safeMsg, false);
  }

  const all = await getAllIntegrationStatuses();
  return all.find((i) => i.provider === 'paypal')!;
}

export async function testDhlIntegration(): Promise<IntegrationDescriptor> {
  const dhlEnvRaw = (process.env.DHL_EXPRESS_ENVIRONMENT || 'test').toLowerCase();
  const mode = dhlEnvRaw === 'production' || dhlEnvRaw === 'live' ? 'production' : 'test';
  const baseUrl =
    mode === 'production'
      ? 'https://express.api.dhl.com/mydhlapi'
      : 'https://express.api.dhl.com/mydhlapi/test';

  if (
    !isRealSecretPresent('DHL_EXPRESS_API_KEY') ||
    !isRealSecretPresent('DHL_EXPRESS_API_SECRET') ||
    !isRealSecretPresent('DHL_EXPRESS_ACCOUNT_NUMBER')
  ) {
    await upsertIntegrationRecord(
      'dhl',
      mode,
      'Configuration Warning',
      'Configuration Warning: DHL_EXPRESS_API_KEY, DHL_EXPRESS_API_SECRET, and DHL_EXPRESS_ACCOUNT_NUMBER are required.',
      false
    );
    const all = await getAllIntegrationStatuses();
    return all.find((i) => i.provider === 'dhl')!;
  }

  try {
    const basicAuth = Buffer.from(
      `${process.env.DHL_EXPRESS_API_KEY!.trim()}:${process.env.DHL_EXPRESS_API_SECRET!.trim()}`
    ).toString('base64');

    const plannedDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const url = `${baseUrl}/rates?accountNumber=${encodeURIComponent(
      process.env.DHL_EXPRESS_ACCOUNT_NUMBER!.trim()
    )}&originCountryCode=TR&originCityName=Istanbul&destinationCountryCode=GB&destinationCityName=London&weight=1&length=30&width=20&height=10&plannedShippingDate=${plannedDate}&isCustomsDeclarable=false&unitOfMeasurement=metric`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`MyDHL API returned HTTP ${response.status}: ${errBody.slice(0, 140)}`);
    }

    await upsertIntegrationRecord(
      'dhl',
      mode,
      'Operational',
      `Authenticated with MyDHL API (${mode}) for account ${process.env.DHL_EXPRESS_ACCOUNT_NUMBER!.trim().slice(0, 3)}***`,
      true
    );
  } catch (err: any) {
    const safeMsg = sanitizeProviderError(err?.message || 'MyDHL API connection failed.');
    await upsertIntegrationRecord('dhl', mode, 'Connection Failed', safeMsg, false);
  }

  const all = await getAllIntegrationStatuses();
  return all.find((i) => i.provider === 'dhl')!;
}

export async function fetchLiveDhlTracking(trackingNumber: string): Promise<{
  supported: boolean;
  liveEvents?: Array<{ stage: string; facility: string; description: string; eventTimestamp: string }>;
  currentLocation?: string;
  status?: string;
  error?: string;
}> {
  if (
    !isRealSecretPresent('DHL_EXPRESS_API_KEY') ||
    !isRealSecretPresent('DHL_EXPRESS_API_SECRET')
  ) {
    return {
      supported: false,
      error: 'DHL Express MyDHL API credentials are not configured in environment variables.',
    };
  }

  const dhlEnvRaw = (process.env.DHL_EXPRESS_ENVIRONMENT || 'test').toLowerCase();
  const mode = dhlEnvRaw === 'production' || dhlEnvRaw === 'live' ? 'production' : 'test';
  const baseUrl =
    mode === 'production'
      ? 'https://express.api.dhl.com/mydhlapi'
      : 'https://express.api.dhl.com/mydhlapi/test';

  try {
    const basicAuth = Buffer.from(
      `${process.env.DHL_EXPRESS_API_KEY!.trim()}:${process.env.DHL_EXPRESS_API_SECRET!.trim()}`
    ).toString('base64');

    const response = await fetch(
      `${baseUrl}/shipments/${encodeURIComponent(trackingNumber.trim())}/tracking`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      return {
        supported: false,
        error: sanitizeProviderError(`MyDHL API returned HTTP ${response.status} for airway bill ${trackingNumber}.`),
      };
    }

    const payload = (await response.json()) as any;
    const shipment = payload?.shipments?.[0];
    if (!shipment) {
      return { supported: false, error: 'No live DHL Express shipment found for that airway bill.' };
    }

    const events = (shipment.events || []).map((ev: any) => ({
      stage: ev.typeCode || 'Carrier Scan',
      facility: ev.serviceArea?.[0]?.description || 'DHL Express Facility',
      description: ev.description || 'Carrier checkpoint recorded',
      eventTimestamp: `${ev.date || ''} ${ev.time || ''} UTC`.trim(),
    }));

    return {
      supported: true,
      liveEvents: events,
      currentLocation: events[events.length - 1]?.facility || 'DHL Express Network',
      status: shipment.status?.description || 'International Transit',
    };
  } catch (err: any) {
    return {
      supported: false,
      error: sanitizeProviderError(err?.message || 'Unable to query live MyDHL API.'),
    };
  }
}

export async function testSmtpIntegration(recipientEmail?: string): Promise<IntegrationDescriptor> {
  const portNum = Number(process.env.SMTP_TRANSACTIONAL_PORT || 587);
  const mode = portNum === 465 ? 'TLS-465' : 'STARTTLS-587';

  if (
    !isRealSecretPresent('SMTP_TRANSACTIONAL_HOST') ||
    !isRealSecretPresent('SMTP_TRANSACTIONAL_USER') ||
    !isRealSecretPresent('SMTP_TRANSACTIONAL_PASS')
  ) {
    await upsertIntegrationRecord(
      'smtp',
      mode,
      'Configuration Warning',
      'Configuration Warning: SMTP_TRANSACTIONAL_HOST, SMTP_TRANSACTIONAL_USER, and SMTP_TRANSACTIONAL_PASS are required.',
      false
    );
    const all = await getAllIntegrationStatuses();
    return all.find((i) => i.provider === 'smtp')!;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_TRANSACTIONAL_HOST!.trim(),
      port: portNum,
      secure: portNum === 465,
      auth: {
        user: process.env.SMTP_TRANSACTIONAL_USER!.trim(),
        pass: process.env.SMTP_TRANSACTIONAL_PASS!.trim(),
      },
      connectionTimeout: 10000,
    });

    await transporter.verify();

    let detailMessage = `SMTP handshake verified with ${process.env.SMTP_TRANSACTIONAL_HOST!.trim()}:${portNum}.`;
    if (recipientEmail && recipientEmail.includes('@')) {
      const fromAddr = process.env.SMTP_FROM_EMAIL?.trim() || 'no-reply@galatasaray.org';
      await transporter.sendMail({
        from: `"Galatasaray SK Official Platform" <${fromAddr}>`,
        to: recipientEmail.trim(),
        subject: 'Galatasaray SK Digital Platform · SMTP Connectivity Verification',
        text: `This is an authenticated server-side test email confirming that your SMTP transactional integration (${process.env.SMTP_TRANSACTIONAL_HOST!.trim()}) is operational.`,
      });
      detailMessage = `SMTP handshake verified and test email dispatched to ${recipientEmail.trim()}.`;
    }

    await upsertIntegrationRecord('smtp', mode, 'Operational', detailMessage, true);
  } catch (err: any) {
    const safeMsg = sanitizeProviderError(err?.message || 'SMTP server handshake or authentication failed.');
    await upsertIntegrationRecord('smtp', mode, 'Connection Failed', safeMsg, false);
  }

  const all = await getAllIntegrationStatuses();
  return all.find((i) => i.provider === 'smtp')!;
}

// ============================================================================
// REAL SERVER-SIDE PAYMENT VERIFICATION FOR ORDERS & MEMBERSHIPS
// ============================================================================

export async function verifyStripePaymentServerSide(
  paymentIntentId: string,
  expectedAmountEur: number
): Promise<{ verified: boolean; error?: string }> {
  if (!isRealSecretPresent('STRIPE_SECRET_KEY')) {
    return {
      verified: false,
      error:
        'Stripe integration is not configured: STRIPE_SECRET_KEY is missing in environment variables. Payments cannot be marked as paid without server-side verification.',
    };
  }
  if (!paymentIntentId || !paymentIntentId.startsWith('pi_')) {
    return {
      verified: false,
      error: 'A valid Stripe PaymentIntent ID (pi_...) is required for server-side payment verification.',
    };
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!.trim());
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId.trim());
    if (intent.status !== 'succeeded') {
      return {
        verified: false,
        error: `Stripe PaymentIntent ${intent.id} has status "${intent.status}" instead of "succeeded".`,
      };
    }
    const expectedCents = Math.round(expectedAmountEur * 100);
    if (intent.amount_received < expectedCents) {
      return {
        verified: false,
        error: `Stripe PaymentIntent amount received (${intent.amount_received}) is less than required (${expectedCents} EUR cents).`,
      };
    }
    return { verified: true };
  } catch (err: any) {
    return {
      verified: false,
      error: sanitizeProviderError(err?.message || 'Failed to verify PaymentIntent with Stripe API.'),
    };
  }
}

export async function createStripeCheckoutPaymentIntent(
  amountEur: number,
  metadata: Record<string, string>
): Promise<{ clientSecret?: string; paymentIntentId?: string; error?: string }> {
  if (!isRealSecretPresent('STRIPE_SECRET_KEY')) {
    return {
      error:
        'Configuration Warning: STRIPE_SECRET_KEY is missing in environment variables. Configure Stripe in the Secrets panel before creating live PaymentIntents.',
    };
  }
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!.trim());
    const intent = await stripe.paymentIntents.create({
      amount: Math.max(50, Math.round(amountEur * 100)),
      currency: 'eur',
      metadata,
      automatic_payment_methods: { enabled: true },
    });
    return {
      clientSecret: intent.client_secret || undefined,
      paymentIntentId: intent.id,
    };
  } catch (err: any) {
    return {
      error: sanitizeProviderError(err?.message || 'Unable to create Stripe PaymentIntent.'),
    };
  }
}

export async function createPayPalOrderServerSide(
  amountEur: number,
  referenceId: string
): Promise<{ paypalOrderId?: string; approveUrl?: string; error?: string }> {
  try {
    const { accessToken, baseUrl } = await getPayPalAccessToken();
    const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: referenceId,
            amount: {
              currency_code: 'EUR',
              value: amountEur.toFixed(2),
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        error: sanitizeProviderError(`PayPal Order creation failed (HTTP ${response.status}): ${errText.slice(0, 120)}`),
      };
    }

    const orderData = (await response.json()) as any;
    const approveLink = (orderData.links || []).find((l: any) => l.rel === 'approve')?.href;
    return {
      paypalOrderId: orderData.id,
      approveUrl: approveLink,
    };
  } catch (err: any) {
    return {
      error: sanitizeProviderError(err?.message || 'PayPal REST API order creation failed.'),
    };
  }
}

export async function getPayPalOrderServerSide(
  paypalOrderId: string
): Promise<{ verified: boolean; status?: string; amountEur?: string; error?: string }> {
  if (!paypalOrderId) {
    return { verified: false, error: 'PayPal Order ID is required.' };
  }
  try {
    const { accessToken, baseUrl } = await getPayPalAccessToken();
    const response = await fetch(
      `${baseUrl}/v2/checkout/orders/${encodeURIComponent(paypalOrderId.trim())}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return {
        verified: false,
        error: sanitizeProviderError(`PayPal Order lookup failed (HTTP ${response.status}): ${errText.slice(0, 120)}`),
      };
    }

    const data = (await response.json()) as any;
    const unitAmount = data?.purchase_units?.[0]?.amount?.value || '0.00';
    return {
      verified: data.status === 'COMPLETED' || data.status === 'APPROVED',
      status: data.status,
      amountEur: unitAmount,
    };
  } catch (err: any) {
    return {
      verified: false,
      error: sanitizeProviderError(err?.message || 'Unable to verify PayPal order status server-side.'),
    };
  }
}

export async function verifyAndCapturePayPalOrderServerSide(
  paypalOrderId: string,
  expectedAmountEur?: number
): Promise<{ verified: boolean; captureId?: string; status?: string; error?: string }> {
  if (!paypalOrderId) {
    return { verified: false, error: 'PayPal Order ID is required for server-side capture verification.' };
  }
  try {
    const { accessToken, baseUrl } = await getPayPalAccessToken();

    // First inspect the order status in case it was already captured via /api/payments/paypal/capture-order
    const getRes = await fetch(
      `${baseUrl}/v2/checkout/orders/${encodeURIComponent(paypalOrderId.trim())}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (getRes.ok) {
      const existingData = (await getRes.json()) as any;
      if (existingData.status === 'COMPLETED') {
        const capturedVal = Number(
          existingData?.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value ||
            existingData?.purchase_units?.[0]?.amount?.value ||
            0
        );
        if (expectedAmountEur !== undefined && capturedVal + 0.01 < expectedAmountEur) {
          return {
            verified: false,
            error: `PayPal captured amount (€${capturedVal.toFixed(2)}) is less than expected order total (€${expectedAmountEur.toFixed(2)}).`,
          };
        }
        const existingCaptureId =
          existingData?.purchase_units?.[0]?.payments?.captures?.[0]?.id || existingData.id;
        return {
          verified: true,
          captureId: existingCaptureId,
          status: 'COMPLETED',
        };
      }
    }

    const response = await fetch(
      `${baseUrl}/v2/checkout/orders/${encodeURIComponent(paypalOrderId.trim())}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return {
        verified: false,
        error: sanitizeProviderError(`PayPal Order capture failed (HTTP ${response.status}): ${errText.slice(0, 120)}`),
      };
    }

    const data = (await response.json()) as any;
    if (data.status !== 'COMPLETED') {
      return {
        verified: false,
        error: `PayPal Order status is "${data.status}" instead of "COMPLETED".`,
      };
    }

    const capturedAmount = Number(
      data?.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value ||
        data?.purchase_units?.[0]?.amount?.value ||
        0
    );
    if (expectedAmountEur !== undefined && capturedAmount + 0.01 < expectedAmountEur) {
      return {
        verified: false,
        error: `PayPal captured amount (€${capturedAmount.toFixed(2)}) is less than expected order total (€${expectedAmountEur.toFixed(2)}).`,
      };
    }

    const captureId = data?.purchase_units?.[0]?.payments?.captures?.[0]?.id || data.id;
    return {
      verified: true,
      captureId,
      status: data.status,
    };
  } catch (err: any) {
    return {
      verified: false,
      error: sanitizeProviderError(err?.message || 'Unable to verify PayPal order capture server-side.'),
    };
  }
}
