import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  KeyRound,
  UserCheck,
  ArrowRight,
} from 'lucide-react';
import { UserAccount } from '../types/database';

interface LoginPageProps {
  setupRequired: boolean;
  sessionNotice?: string | null;
  onLoginSuccess: (payload: { user: UserAccount; csrfToken: string }) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  setupRequired,
  sessionNotice,
  onLoginSuccess,
}) => {
  // Login Form State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  // One-Time Initial Super Admin Setup State
  const [setupFullName, setSetupFullName] = useState('');
  const [setupUsername, setSetupUsername] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPhone, setSetupPhone] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
  const [showSetupPassword, setShowSetupPassword] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setErrorMessage('Please enter your authorized username or email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your account password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: cleanIdentifier,
          password,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        if (typeof data.remainingAttempts === 'number') {
          setRemainingAttempts(data.remainingAttempts);
        }
        setErrorMessage(data.error || 'Authentication failed. Please check your credentials.');
        setIsSubmitting(false);
        return;
      }

      setPassword('');
      setRemainingAttempts(null);
      onLoginSuccess({
        user: data.user,
        csrfToken: data.csrfToken,
      });
    } catch {
      setErrorMessage('Network error while connecting to authentication server. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleInitialSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!setupFullName.trim() || setupFullName.trim().length < 2) {
      setErrorMessage('Please enter the Super Admin full name.');
      return;
    }
    if (!setupUsername.trim() || setupUsername.trim().length < 3) {
      setErrorMessage('Username must be at least 3 characters.');
      return;
    }
    if (!setupEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(setupEmail.trim())) {
      setErrorMessage('Please enter a valid Super Admin email address.');
      return;
    }
    if (setupPassword.length < 8) {
      setErrorMessage('Initial Super Admin password must be at least 8 characters.');
      return;
    }
    if (setupPassword !== setupConfirmPassword) {
      setErrorMessage('Passwords do not match. Please confirm your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fullName: setupFullName.trim(),
          username: setupUsername.trim(),
          email: setupEmail.trim(),
          phone: setupPhone.trim(),
          password: setupPassword,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setErrorMessage(data.error || 'Initial setup failed.');
        setIsSubmitting(false);
        return;
      }

      setSetupPassword('');
      setSetupConfirmPassword('');
      onLoginSuccess({
        user: data.user,
        csrfToken: data.csrfToken,
      });
    } catch {
      setErrorMessage('Network error while initializing Super Admin account.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-950 flex flex-col justify-center items-center p-4 sm:p-6 font-sans antialiased selection:bg-emerald-600 selection:text-white">
      {/* Main Authentication Container */}
      <div className="w-full max-w-4xl bg-white rounded-2xl border border-emerald-800/30 shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Brand & Security Architecture Column */}
        <div className="lg:col-span-5 bg-emerald-900 text-white p-6 sm:p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-emerald-800">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-800 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-inner shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Crystal Gift House
                </h1>
                <p className="text-xs text-amber-300 font-semibold">
                  Business OS • ক্রিস্টাল গিফট হাউস
                </p>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/80 border border-emerald-700 text-[11px] font-semibold text-emerald-200">
                <Lock className="w-3.5 h-3.5 text-amber-300" />
                <span>Private Enterprise Portal</span>
              </div>
              <h2 className="text-xl font-bold text-white leading-snug">
                Authorized E-Commerce & Financial Operations
              </h2>
              <p className="text-xs text-emerald-100/85 leading-relaxed">
                Restricted business operating system for inventory control, courier COD reconciliation, AI order processing, and accounting.
              </p>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-emerald-800/80 text-xs text-emerald-100">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Zero Public Access:</strong> All routes, customer records, and APIs require verified server session authentication.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <KeyRound className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Salted Password Hashing:</strong> Credentials are protected with PBKDF2-CGH hashing, HttpOnly session cookies, and CSRF tokens.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <UserCheck className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Invite-Only Provisioning:</strong> No public sign-up. Only the Super Admin can create or authorize staff accounts.
                </span>
              </div>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-emerald-800/80 flex items-center justify-between text-[11px] text-emerald-300/90">
            <span>BDT (৳) • Asia/Dhaka</span>
            <span className="font-mono">v2.5 Secure Edition</span>
          </div>
        </div>

        {/* Right Form Column */}
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-center bg-white">
          {!setupRequired ? (
            <div className="space-y-5">
              <div className="border-b border-slate-100 pb-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Authorized Staff & Admin Sign-In
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  Sign in to Crystal Gift House Business OS
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Enter your assigned email address or username and password to unlock your workspace.
                </p>
              </div>

              {sessionNotice && !errorMessage && (
                <div
                  role="status"
                  className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs font-medium flex items-start gap-2.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>{sessionNotice}</span>
                </div>
              )}

              {errorMessage && (
                <div
                  role="alert"
                  data-testid="login-error-alert"
                  className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs font-medium flex items-start gap-2.5"
                >
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div>{errorMessage}</div>
                    {remainingAttempts !== null && remainingAttempts > 0 && (
                      <div className="text-[11px] text-red-700 font-mono">
                        Remaining login attempts before temporary lockout: {remainingAttempts}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs" noValidate>
                <div>
                  <label
                    htmlFor="login-identifier"
                    className="block font-bold text-slate-700 mb-1.5"
                  >
                    Email Address or Username
                  </label>
                  <input
                    id="login-identifier"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter your email or username"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700 transition-all"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="login-password"
                      className="block font-bold text-slate-700"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 cursor-pointer"
                    >
                      {showPassword ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Hide Password</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Show Password</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-700 transition-all"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="login-submit-button"
                  className="w-full py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{isSubmitting ? 'Verifying Credentials...' : 'Sign In to Dashboard'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500 flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  Public sign-up is permanently disabled. To request a new account or reset a locked password, contact your Super Admin.
                </span>
              </div>
            </div>
          ) : (
            /* One-Time First Super Admin Setup View */
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold uppercase tracking-wider">
                  One-Time Initial Setup
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  Initialize First Super Admin Account
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure the primary owner Super Admin account. This setup screen will be permanently disabled immediately after account creation.
                </p>
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs font-medium flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleInitialSetupSubmit} className="space-y-3 text-xs" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={setupFullName}
                      onChange={(e) => setSetupFullName(e.target.value)}
                      placeholder="e.g. Md. Rabby Islam Sanny"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Login Username *</label>
                    <input
                      type="text"
                      required
                      value={setupUsername}
                      onChange={(e) => setSetupUsername(e.target.value)}
                      placeholder="e.g. admin"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Admin Email *</label>
                    <input
                      type="email"
                      required
                      value={setupEmail}
                      onChange={(e) => setSetupEmail(e.target.value)}
                      placeholder="owner@example.com"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={setupPhone}
                      onChange={(e) => setSetupPhone(e.target.value)}
                      placeholder="018XXXXXXXX"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-slate-700">
                        Password (min 8 chars) *
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowSetupPassword(!showSetupPassword)}
                        className="text-[10px] font-semibold text-emerald-800 cursor-pointer"
                      >
                        {showSetupPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <input
                      type={showSetupPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      placeholder="Strong password"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Confirm Password *
                    </label>
                    <input
                      type={showSetupPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={setupConfirmPassword}
                      onChange={(e) => setSetupConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-900"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  {isSubmitting
                    ? 'Creating Primary Super Admin...'
                    : 'Complete Initial Setup & Lock Setup Mode'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
