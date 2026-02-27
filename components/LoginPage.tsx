import React, { useState, useCallback } from 'react';
import {
  Mail, Lock, Building2, ArrowRight, Loader2, AlertCircle,
  HardHat, KeyRound, Download, CheckCircle2, ArrowLeft, Eye, EyeOff,
} from 'lucide-react';
import { UserSession } from '../types';
import { signInWithEmail, signUpWithEmail, crewLogin, sendPasswordReset } from '../services/auth';

// ─── Extracted sub-components (outside render to avoid remount on every keystroke) ───

const ErrorBanner: React.FC<{ error: string | null }> = ({ error }) =>
  error ? (
    <div className="mb-5 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2 border border-red-100">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span>{error}</span>
    </div>
  ) : null;

const SuccessBanner: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div className="mb-5 p-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg flex items-center gap-2 border border-emerald-100">
      <CheckCircle2 className="w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
  ) : null;

const SubmitButton: React.FC<{ label: string; isLoading: boolean }> = ({ label, isLoading }) => (
  <button
    type="submit"
    disabled={isLoading}
    className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-3 rounded-xl shadow-lg shadow-red-200 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
  >
    {isLoading ? (
      <>
        <Loader2 className="w-5 h-5 animate-spin" />
        Processing...
      </>
    ) : (
      <>
        {label}
        <ArrowRight className="w-5 h-5" />
      </>
    )}
  </button>
);

interface InputFieldProps {
  label: string;
  icon: React.FC<any>;
  type?: string;
  placeholder: string;
  value: string;
  field: string;
  required?: boolean;
  showToggle?: boolean;
  showPassword?: boolean;
  onTogglePassword?: () => void;
  onChange: (field: string, value: string) => void;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  icon: Icon,
  type = 'text',
  placeholder,
  value,
  field,
  required = true,
  showToggle = false,
  showPassword = false,
  onTogglePassword,
  onChange,
}) => (
  <div>
    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">
      {label}
    </label>
    <div className="relative">
      <Icon className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
      <input
        type={showToggle ? (showPassword ? 'text' : 'password') : type}
        required={required}
        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand outline-none transition-all text-sm"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
      />
      {showToggle && onTogglePassword && (
        <button
          type="button"
          onClick={onTogglePassword}
          className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}
    </div>
  </div>
);

// ─── Main Component ──────────────────────────────────────────

interface LoginPageProps {
  onLoginSuccess: (session: UserSession) => void;
  installPrompt: any;
  onInstall: () => void;
}

type View = 'login' | 'signup' | 'crew' | 'forgot';

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, installPrompt, onInstall }) => {
  const [view, setView] = useState<View>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    companyId: '',
    crewPin: '',
    resetEmail: '',
  });

  const resetForm = () => {
    setError(null);
    setSuccessMsg(null);
    setShowPassword(false);
  };

  const switchView = (v: View) => {
    resetForm();
    setView(v);
  };

  const handleField = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const togglePassword = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  // ── Admin Login ──────────────────────────────────────────
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { session, error: authError } = await signInWithEmail(formData.email, formData.password);
      if (authError) throw new Error(authError);
      if (session) onLoginSuccess(session);
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Admin Signup ─────────────────────────────────────────
  const handleAdminSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!formData.companyName.trim()) {
      setError('Company name is required.');
      return;
    }

    setIsLoading(true);
    try {
      const { session, error: authError } = await signUpWithEmail(
        formData.email,
        formData.password,
        formData.companyName
      );
      if (authError) {
        if (authError.includes('check your email') || authError.includes('confirm')) {
          setSuccessMsg(authError);
          return;
        }
        throw new Error(authError);
      }
      if (session) onLoginSuccess(session);
    } catch (err: any) {
      setError(err.message || 'Signup failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Crew Login ───────────────────────────────────────────
  const handleCrewLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { session, error: authError } = await crewLogin(formData.email, formData.password);
      if (authError) throw new Error(authError);
      if (session) onLoginSuccess(session);
    } catch (err: any) {
      setError(err.message || 'Crew login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Password Reset ──────────────────────────────────────
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { error: resetError } = await sendPasswordReset(formData.resetEmail);
      if (resetError) throw new Error(resetError);
      setSuccessMsg('Password reset link sent! Check your email.');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link.');
    } finally {
      setIsLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-300 relative">
        {/* PWA Install Banner */}
        {installPrompt && (
          <button
            onClick={onInstall}
            className="w-full bg-emerald-600 text-white py-2 px-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-4 h-4" /> Install Desktop/Mobile App
          </button>
        )}

        {/* Header / Logo */}
        <div className="bg-slate-900 p-10 text-center relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center justify-center select-none">
            <div className="flex items-center gap-1 mb-2">
              <div className="bg-brand text-white px-2.5 py-1 -skew-x-12 transform shadow-sm flex items-center justify-center">
                <span className="skew-x-12 font-black text-3xl tracking-tighter leading-none">RFE</span>
              </div>
              <span className="text-3xl font-black tracking-tighter text-brand-yellow leading-none">
                RFE
              </span>
            </div>
            <span className="text-[0.6rem] font-bold tracking-[0.2em] text-brand uppercase px-2 py-0.5 leading-none">
              FOAM EQUIPMENT
            </span>
            <p className="text-slate-400 text-xs mt-4 uppercase tracking-widest font-bold">
              Professional Estimation Suite
            </p>
          </div>
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand via-slate-900 to-slate-900"></div>
        </div>

        {/* Tab Switcher — hidden on forgot password */}
        {view !== 'forgot' && (
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => switchView(view === 'signup' ? 'signup' : 'login')}
              className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${
                view === 'login' || view === 'signup'
                  ? 'text-brand border-b-2 border-brand'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Admin Access
            </button>
            <button
              onClick={() => switchView('crew')}
              className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${
                view === 'crew'
                  ? 'text-brand border-b-2 border-brand'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Crew / Rig Login
            </button>
          </div>
        )}

        {/* ──────── ADMIN LOGIN ──────── */}
        {view === 'login' && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">Welcome Back</h2>
            <ErrorBanner error={error} />
            <SuccessBanner message={successMsg} />

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <InputField
                label="Email"
                icon={Mail}
                type="email"
                placeholder="you@company.com"
                value={formData.email}
                field="email"
                onChange={handleField}
              />
              <InputField
                label="Password"
                icon={Lock}
                type="password"
                placeholder="••••••••"
                value={formData.password}
                field="password"
                showToggle
                showPassword={showPassword}
                onTogglePassword={togglePassword}
                onChange={handleField}
              />
              <SubmitButton label="Sign In" isLoading={isLoading} />
            </form>

            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => switchView('forgot')}
                className="text-sm text-slate-500 hover:text-brand font-medium transition-colors"
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={() => switchView('signup')}
                className="text-sm text-slate-500 hover:text-brand font-medium transition-colors"
              >
                Don't have an account? <span className="font-bold">Sign up</span>
              </button>
            </div>
          </div>
        )}

        {/* ──────── ADMIN SIGNUP ──────── */}
        {view === 'signup' && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">
              Create Company Account
            </h2>
            <ErrorBanner error={error} />
            <SuccessBanner message={successMsg} />

            <form onSubmit={handleAdminSignup} className="space-y-4">
              <InputField
                label="Company Name"
                icon={Building2}
                placeholder="Acme Insulation"
                value={formData.companyName}
                field="companyName"
                onChange={handleField}
              />
              <InputField
                label="Email"
                icon={Mail}
                type="email"
                placeholder="admin@company.com"
                value={formData.email}
                field="email"
                onChange={handleField}
              />
              <InputField
                label="Password"
                icon={Lock}
                type="password"
                placeholder="Min 6 characters"
                value={formData.password}
                field="password"
                showToggle
                showPassword={showPassword}
                onTogglePassword={togglePassword}
                onChange={handleField}
              />
              <InputField
                label="Confirm Password"
                icon={Lock}
                type="password"
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                field="confirmPassword"
                onChange={handleField}
              />
              <SubmitButton label="Create Account" isLoading={isLoading} />
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => switchView('login')}
                className="text-sm text-slate-500 hover:text-brand font-medium transition-colors"
              >
                Already have an account? <span className="font-bold">Sign in</span>
              </button>
            </div>
          </div>
        )}

        {/* ──────── CREW / RIG LOGIN ──────── */}
        {view === 'crew' && (
          <div className="p-8">
            <div className="flex items-center justify-center gap-2 mb-6">
              <HardHat className="w-6 h-6 text-brand" />
              <h2 className="text-xl font-bold text-slate-800">Job Execution Portal</h2>
            </div>
            <ErrorBanner error={error} />

            <form onSubmit={handleCrewLogin} className="space-y-4">
              <InputField
                label="Crew Email"
                icon={Mail}
                type="email"
                placeholder="crew@company.com"
                value={formData.email}
                field="email"
                onChange={handleField}
              />
              <InputField
                label="Password"
                icon={Lock}
                type="password"
                placeholder="••••••••"
                value={formData.password}
                field="password"
                showToggle
                showPassword={showPassword}
                onTogglePassword={togglePassword}
                onChange={handleField}
              />
              <SubmitButton label="Access Jobs" isLoading={isLoading} />
            </form>

            <div className="mt-6 text-center text-xs text-slate-400">
              Your admin sets up crew login credentials in the Organization Profile.
            </div>
          </div>
        )}

        {/* ──────── FORGOT PASSWORD ──────── */}
        {view === 'forgot' && (
          <div className="p-8">
            <button
              type="button"
              onClick={() => switchView('login')}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-brand mb-4 font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to login
            </button>

            <h2 className="text-xl font-bold text-slate-800 mb-2 text-center">Reset Password</h2>
            <p className="text-sm text-slate-500 text-center mb-6">
              Enter your email and we'll send a reset link.
            </p>
            <ErrorBanner error={error} />
            <SuccessBanner message={successMsg} />

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <InputField
                label="Email"
                icon={Mail}
                type="email"
                placeholder="you@company.com"
                value={formData.resetEmail}
                field="resetEmail"
                onChange={handleField}
              />
              <SubmitButton label="Send Reset Link" isLoading={isLoading} />
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
