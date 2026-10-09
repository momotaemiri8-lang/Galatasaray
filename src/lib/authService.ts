import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { db } from '../db/index.ts';
import { users, authSessions } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { sanitizeProviderError } from './integrations.ts';

const SUPER_ADMIN_EMAIL = 'luxmartsupport@gmail.com';

export function hashOpaqueToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashPasswordScrypt(password: string, existingSalt?: string): {
  salt: string;
  hash: string;
} {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return {
    salt,
    hash: derivedKey.toString('hex'),
  };
}

export function verifyPasswordScrypt(
  password: string,
  salt: string,
  storedHash: string
): boolean {
  if (!salt || !storedHash) return false;
  try {
    const { hash } = hashPasswordScrypt(password, salt);
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  message?: string;
} {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must include at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must include at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must include at least one number.' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, message: 'Password must include at least one special character.' };
  }
  return { valid: true };
}

export function isValidEmailFormat(email: string): boolean {
  const clean = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean);
}

function isSmtpConfigured(): boolean {
  const h = process.env.SMTP_TRANSACTIONAL_HOST?.trim();
  const u = process.env.SMTP_TRANSACTIONAL_USER?.trim();
  const p = process.env.SMTP_TRANSACTIONAL_PASS?.trim();
  return Boolean(
    h &&
      u &&
      p &&
      !h.toLowerCase().includes('placeholder') &&
      !u.toLowerCase().includes('placeholder')
  );
}

export async function dispatchTransactionalAuthEmail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ sentViaSmtp: boolean; diagnostic: string }> {
  if (!isSmtpConfigured()) {
    return {
      sentViaSmtp: false,
      diagnostic:
        'SMTP_TRANSACTIONAL_HOST / USER / PASS are not configured in the AI Studio Secrets panel. Configure your transactional SMTP provider in Secrets to deliver emails externally.',
    };
  }

  try {
    const portNum = Number(process.env.SMTP_TRANSACTIONAL_PORT || 587);
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

    const fromAddr = process.env.SMTP_FROM_EMAIL?.trim() || 'no-reply@galatasaray.org';
    await transporter.sendMail({
      from: `"Galatasaray SK Official Platform" <${fromAddr}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    return {
      sentViaSmtp: true,
      diagnostic: `Dispatched transactional email to ${options.to} via configured SMTP gateway.`,
    };
  } catch (err: any) {
    return {
      sentViaSmtp: false,
      diagnostic: sanitizeProviderError(
        err?.message || 'Failed to dispatch transactional email via SMTP.'
      ),
    };
  }
}

export function normalizeRole(rawRole: string | null | undefined, email?: string): 'ADMIN' | 'USER' {
  if (email && email.trim().toLowerCase() === SUPER_ADMIN_EMAIL) {
    return 'ADMIN';
  }
  const upper = String(rawRole || '').trim().toUpperCase();
  if (upper === 'ADMIN' || upper === 'SUPER ADMINISTRATOR') {
    return 'ADMIN';
  }
  return 'USER';
}

export async function createAuthenticatedSession(params: {
  userUid: string;
  userEmail: string;
  userRole: 'ADMIN' | 'USER';
  rememberMe: boolean;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{
  rawSessionToken: string;
  csrfToken: string;
  expiresAt: Date;
}> {
  const rawSessionToken = generateSecureToken(32);
  const sessionTokenHash = hashOpaqueToken(rawSessionToken);
  const csrfToken = generateSecureToken(24);
  const ttlMs = params.rememberMe
    ? 1000 * 60 * 60 * 24 * 30 // 30 days
    : 1000 * 60 * 60 * 12; // 12 hours
  const expiresAt = new Date(Date.now() + ttlMs);

  await db.insert(authSessions).values({
    sessionTokenHash,
    userUid: params.userUid,
    userEmail: params.userEmail,
    userRole: params.userRole,
    csrfToken,
    rememberMe: params.rememberMe,
    ipAddress: params.ipAddress || '',
    userAgent: (params.userAgent || '').slice(0, 220),
    expiresAt,
  });

  return { rawSessionToken, csrfToken, expiresAt };
}

export async function findUserByEmailCaseInsensitive(email: string) {
  const clean = email.trim().toLowerCase();
  const all = await db.select().from(users);
  return all.find((u) => u.email.trim().toLowerCase() === clean) || null;
}

export function sanitizeUserForClient(u: typeof users.$inferSelect) {
  const effectiveRole = normalizeRole(u.role, u.email);
  return {
    id: u.id,
    uid: u.uid,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    country: u.country,
    dateOfBirth: u.dateOfBirth,
    role: effectiveRole,
    emailVerified: u.emailVerified,
    accountDisabled: u.accountDisabled,
    membershipTier: u.membershipTier,
    membershipNumber: u.membershipNumber,
    membershipStatus: u.membershipStatus,
    membershipExpiry: u.membershipExpiry,
    twoFactorEnabled: u.twoFactorEnabled,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  };
}
