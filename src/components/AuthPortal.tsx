import React, { useState } from 'react';
import { apiFetch } from '../lib/apiClient.ts';
import {
  Shield,
  Mail,
  Lock,
  User as UserIcon,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  ArrowRight,
  RefreshCw,
  Eye,
  EyeOff,
  Globe,
} from 'lucide-react';

export type AuthViewMode =
  | 'login'
  | 'register'
  | 'verify-email'
  | 'forgot-password'
  | 'reset-password';

interface AuthPortalProps {
  initialMode?: AuthViewMode;
  initialToken?: string;
  onAuthenticated: (sessionToken: string, userProfile: any) => void;
  onGoogleSignIn: () => Promise<void>;
  showToast: (msg: string) => void;
}

export const AuthPortal: React.FC<AuthPortalProps> = ({
  initialMode = 'login',
  initialToken = '',
  onAuthenticated,
  onGoogleSignIn,
  showToast,
}) => {
  const [mode, setMode] = useState<AuthViewMode>(initialMode);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [smtpDiagnostic, setSmtpDiagnostic] = useState<string | null>(null);

  // Registration & Login Fields
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [country, setCountry] = useState<string>('Turkey');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Token Fields (Email Verification & Password Reset)
  const [tokenInput, setTokenInput] = useState<string>(initialToken);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');

  const switchMode = (next: AuthViewMode) => {
    setMode(next);
    setErrorMessage(null);
    setSuccessMessage(null);
    setSmtpDiagnostic(null);
  };

  // Password strength checklist for UI feedback
  const passwordChecks = [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'One uppercase letter (A-Z)', pass: /[A-Z]/.test(password) },
    { label: 'One lowercase letter (a-z)', pass: /[a-z]/.test(password) },
    { label: 'One number (0-9)', pass: /[0-9]/.test(password) },
    { label: 'One special symbol (!@#$...)', pass: /[^A-Za-z0-9]/.test(password) },
  ];

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setSmtpDiagnostic(null);

    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setErrorMessage('All required fields must be completed.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Password and Confirm Password do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          country: country.trim() || 'Turkey',
          password,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Registration failed.');
      } else {
        setSuccessMessage(data.message || 'Account created! Please verify your email address.');
        if (data.emailDelivery?.diagnostic) {
          setSmtpDiagnostic(data.emailDelivery.diagnostic);
        }
        showToast('Account registered! Please verify your email address.');
        setPassword('');
        setConfirmPassword('');
        setMode('verify-email');
      }
    } catch {
      setErrorMessage('Network error while communicating with authentication server.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          rememberMe,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Invalid email address or password.');
      } else if (data.authenticated && data.sessionToken) {
        setSuccessMessage('Sign-in verified! Redirecting to your Supporter Dashboard...');
        if (data.emailVerificationReminder) {
          showToast(data.emailVerificationReminder);
        } else {
          showToast(`Welcome back, ${data.user?.fullName || data.user?.email}!`);
        }
        onAuthenticated(data.sessionToken, data.user);
      }
    } catch {
      setErrorMessage('Unable to reach authentication server.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!tokenInput.trim()) {
      setErrorMessage('Please enter the verification token from your email link.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Verification token is invalid or expired.');
      } else {
        setSuccessMessage(data.message || 'Email verified! You may now sign in.');
        showToast('Email address verified!');
        setTimeout(() => switchMode('login'), 1800);
      }
    } catch {
      setErrorMessage('Unable to verify email token.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!email.trim()) {
      setErrorMessage('Enter your registered email address above to resend the verification link.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Could not resend verification email.');
      } else {
        setSuccessMessage(data.message);
        if (data.diagnostic) setSmtpDiagnostic(data.diagnostic);
      }
    } catch {
      setErrorMessage('Unable to resend verification email.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!email.trim()) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Unable to process password reset request.');
      } else {
        setSuccessMessage(data.message);
      }
    } catch {
      setErrorMessage('Network error while requesting password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!tokenInput.trim() || !newPassword || !confirmNewPassword) {
      setErrorMessage('Reset token, new password, and confirmation are required.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenInput.trim(),
          newPassword,
          confirmPassword: confirmNewPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Password reset failed.');
      } else {
        setSuccessMessage(data.message);
        showToast('Password updated! Please sign in with your new password.');
        setNewPassword('');
        setConfirmNewPassword('');
        setTimeout(() => switchMode('login'), 1800);
      }
    } catch {
      setErrorMessage('Unable to complete password reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto my-8">
      <div className="rounded-3xl border border-[#232736] bg-[#11131B] p-8 sm:p-10 shadow-2xl space-y-8">
        {/* Club Crest Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <img
            src="/src/assets/images/galatasaray_logo.png"
            alt="Galatasaray SK Official Emblem"
            className="w-20 h-20 rounded-2xl object-contain bg-[#07080C] p-2 border border-[#FDB912]/40 shadow-xl"
          />
          <div>
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#FDB912]">
              Galatasaray SK · Sovereign Identity Gateway
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mt-1">
              {mode === 'login' && 'Supporter & Member Sign In'}
              {mode === 'register' && 'Create Official Supporter Account'}
              {mode === 'verify-email' && 'Email Address Verification'}
              {mode === 'forgot-password' && 'Account Password Recovery'}
              {mode === 'reset-password' && 'Set New Account Password'}
            </h1>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#07080C] p-1.5 border border-[#232736]">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`py-2.5 rounded-xl text-xs font-semibold transition-all ${
              mode === 'login'
                ? 'bg-[#A90432] text-white shadow'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`py-2.5 rounded-xl text-xs font-semibold transition-all ${
              mode === 'register'
                ? 'bg-[#A90432] text-white shadow'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => switchMode('verify-email')}
            className={`py-2.5 rounded-xl text-xs font-semibold transition-all ${
              mode === 'verify-email'
                ? 'bg-[#A90432] text-white shadow'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            Verify Email
          </button>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <div className="rounded-2xl border border-[#EF4444]/40 bg-[#EF4444]/10 p-4 flex items-start gap-3 text-xs text-[#EF4444]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="rounded-2xl border border-[#10B981]/40 bg-[#10B981]/10 p-4 space-y-2 text-xs text-[#10B981]">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-medium">{successMessage}</span>
            </div>
            {smtpDiagnostic && (
              <p className="text-[11px] text-[#94A3B8] pl-7">{smtpDiagnostic}</p>
            )}
          </div>
        )}

        {/* 1. LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="supporter@example.com"
                  className="w-full rounded-xl border border-[#232736] bg-[#07080C] pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-[#FDB912]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-[#94A3B8]">Password</label>
                <button
                  type="button"
                  onClick={() => switchMode('forgot-password')}
                  className="text-xs text-[#FDB912] hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-[#232736] bg-[#07080C] pl-10 pr-10 py-3 text-sm text-white focus:outline-none focus:border-[#FDB912]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="inline-flex items-center gap-2 text-[#94A3B8] cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[#232736] bg-[#07080C] text-[#A90432]"
                />
                <span>Remember session for 30 days</span>
              </label>
              <button
                type="button"
                onClick={() => switchMode('verify-email')}
                className="text-[#94A3B8] hover:text-white"
              >
                Need email verification?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#A90432] to-[#8B0329] hover:from-[#8B0329] hover:to-[#A90432] disabled:opacity-50 text-sm font-semibold text-white shadow-lg shadow-[#A90432]/25 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Authenticating...
                </>
              ) : (
                <>
                  Sign In to Supporter Hub <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#232736]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-[#11131B] px-3 text-[#94A3B8] font-mono uppercase">
                  Or Continue With Federated SSO
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onGoogleSignIn}
              className="w-full py-3 rounded-xl border border-[#232736] bg-[#07080C] hover:border-[#FDB912]/50 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors"
            >
              <Shield className="w-4 h-4 text-[#FDB912]" /> Sign In with Google Account
            </button>
          </form>
        )}

        {/* 2. REGISTRATION FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1">Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Kerem Aktürkoğlu"
                  className="w-full rounded-xl border border-[#232736] bg-[#07080C] pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-[#FDB912]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="supporter@example.com"
                    className="w-full rounded-xl border border-[#232736] bg-[#07080C] pl-10 pr-3 py-3 text-sm text-white focus:outline-none focus:border-[#FDB912]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1">Country</label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Turkey"
                    className="w-full rounded-xl border border-[#232736] bg-[#07080C] pl-10 pr-3 py-3 text-sm text-white focus:outline-none focus:border-[#FDB912]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1">Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create strong password"
                  className="w-full rounded-xl border border-[#232736] bg-[#07080C] px-4 py-3 text-sm text-white focus:outline-none focus:border-[#FDB912]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full rounded-xl border border-[#232736] bg-[#07080C] px-4 py-3 text-sm text-white focus:outline-none focus:border-[#FDB912]"
                />
              </div>
            </div>

            {/* Password Strength Requirements */}
            <div className="rounded-2xl border border-[#232736] bg-[#07080C] p-4 space-y-2">
              <div className="text-[11px] font-mono uppercase text-[#94A3B8]">
                Cryptographic Password Requirements (Scrypt Hashed Server-Side)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                {passwordChecks.map((chk, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-1.5 ${
                      chk.pass ? 'text-[#10B981]' : 'text-[#94A3B8]'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{chk.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#A90432] hover:bg-[#8B0329] disabled:opacity-50 text-sm font-semibold text-white shadow-lg shadow-[#A90432]/25"
            >
              {loading ? 'Creating Encrypted Account...' : 'Create Official Supporter Account'}
            </button>
          </form>
        )}

        {/* 3. EMAIL VERIFICATION FORM */}
        {mode === 'verify-email' && (
          <div className="space-y-5">
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Full authenticated access (GSStore checkout, live auction bidding, and VIP bookings)
              requires a verified email address. Paste the verification token sent to your email or
              request a fresh verification link below.
            </p>
            <form onSubmit={handleVerifyEmailToken} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                  Verification Token
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#FDB912] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Paste verification token from your email link"
                    className="w-full rounded-xl border border-[#232736] bg-[#07080C] pl-10 pr-4 py-3 text-xs font-mono text-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-[#A90432] hover:bg-[#8B0329] disabled:opacity-50 text-xs font-semibold text-white"
              >
                {loading ? 'Verifying Token...' : 'Verify Email Address'}
              </button>
            </form>

            <div className="border-t border-[#232736] pt-4 space-y-3">
              <label className="block text-xs text-[#94A3B8]">
                Need a new verification link? Enter your email:
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="supporter@example.com"
                  className="flex-1 rounded-xl border border-[#232736] bg-[#07080C] px-4 py-2.5 text-xs text-white"
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleResendVerification}
                  className="px-4 py-2.5 rounded-xl border border-[#232736] bg-[#07080C] hover:border-[#FDB912] text-xs font-semibold text-[#FDB912]"
                >
                  Resend Email
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. FORGOT PASSWORD FORM */}
        {mode === 'forgot-password' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Enter the email address associated with your Galatasaray SK account. We will send an
              expiring password reset token (valid for 30 minutes).
            </p>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="supporter@example.com"
                className="w-full rounded-xl border border-[#232736] bg-[#07080C] px-4 py-3 text-sm text-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#A90432] hover:bg-[#8B0329] text-xs font-semibold text-white"
            >
              {loading ? 'Dispatching Reset Link...' : 'Send Password Reset Email'}
            </button>
            <div className="flex items-center justify-between text-xs pt-2">
              <button
                type="button"
                onClick={() => switchMode('reset-password')}
                className="text-[#FDB912] hover:underline"
              >
                Already have a reset token?
              </button>
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-[#94A3B8] hover:text-white"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* 5. RESET PASSWORD FORM */}
        {mode === 'reset-password' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                Password Reset Token
              </label>
              <input
                type="text"
                required
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste 30-minute reset token"
                className="w-full rounded-xl border border-[#232736] bg-[#07080C] px-4 py-3 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Strong new password"
                className="w-full rounded-xl border border-[#232736] bg-[#07080C] px-4 py-3 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full rounded-xl border border-[#232736] bg-[#07080C] px-4 py-3 text-sm text-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#A90432] hover:bg-[#8B0329] text-xs font-semibold text-white"
            >
              {loading ? 'Updating Password...' : 'Save New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
