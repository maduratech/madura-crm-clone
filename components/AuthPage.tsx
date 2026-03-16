import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AUTH_SESSION_LOST_KEY, AUTH_INACTIVE_KEY } from '../lib/authConstants';
import { IconCustomers, IconEye, IconEyeOff, IconX } from '../constants';
import { useToast } from './ToastProvider';

const ResetPasswordModal: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setMessage('Password reset link has been sent to your email.');
    } catch (err: any) {
      const msg = err?.message || '';
      const isEmailSendFailure = msg.includes('500') || msg.includes('recovery email') || msg.includes('Authentication Failed') || msg.includes('Error sending');
      setError(isEmailSendFailure
        ? 'We couldn\'t send the reset link right now. Please try again later or contact your administrator.'
        : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="w-full max-w-[calc(100vw-2rem)] sm:max-w-sm bg-slate-800/80 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 p-5 sm:p-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center gap-2 mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-white truncate">Reset Password</h2>
          <button onClick={onClose} className="p-2 -m-2 rounded-full text-slate-400 hover:bg-slate-700/50 touch-manipulation shrink-0" aria-label="Close">
            <IconX className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-300 mb-4 sm:mb-6">Enter your email address and we will send you a link to reset your password.</p>

        {message ? (
          <p className="text-sm text-green-400 bg-green-900/50 p-3 rounded-md">{message}</p>
        ) : (
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium text-slate-300">
                Email address
              </label>
              <input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 bg-slate-900/50 border border-slate-600 rounded-md shadow-sm text-white placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm"
              />
            </div>

            {error && <p className="text-sm text-red-400 bg-red-900/50 p-3 rounded-md break-words">{error}</p>}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 sm:py-2 px-4 min-h-[44px] sm:min-h-0 border border-transparent rounded-[5px] shadow-sm text-sm font-medium text-white bg-[#191974] hover:bg-[#13135c] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-500 disabled:cursor-not-allowed touch-manipulation"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : 'Send Reset Link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

const AuthPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'password' | 'magiclink'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sessionLostMessage, setSessionLostMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    if (sessionStorage.getItem(AUTH_INACTIVE_KEY)) {
      sessionStorage.removeItem(AUTH_INACTIVE_KEY);
      setSessionLostMessage('Your account is inactive. Please contact your administrator to reactivate.');
    } else if (sessionStorage.getItem(AUTH_SESSION_LOST_KEY)) {
      sessionStorage.removeItem(AUTH_SESSION_LOST_KEY);
      setSessionLostMessage('You were signed out. If you signed in on another device, that’s expected — sign in again below.');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }
      // On success, AuthProvider will pick up the session and redirect.
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('NetworkError') || msg.includes('Failed to fetch')) {
        setError('Connection failed. Please check your internet or disable any ad-blockers/extensions that might be blocking the connection.');
      } else {
        setError(msg || 'Something went wrong.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setMessage('Check your email for the magic link to sign in.');
    } catch (err: any) {
      if (err?.message?.includes('NetworkError') || err?.message?.includes('Failed to fetch')) {
        setError('Connection failed. Please check your internet or disable any ad-blockers.');
      } else {
        setError(err?.message ?? 'Something went wrong.');
      }
    } finally {
      setLoading(false);
    }
  };

  const TabButton: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
  }> = ({ label, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`w-1/2 py-3 sm:py-2.5 text-xs sm:text-sm font-semibold text-center transition-colors duration-200 rounded-md touch-manipulation ${isActive
        ? 'bg-slate-700 text-white shadow-inner'
        : 'text-slate-300 hover:bg-slate-700/50'
        }`}
      role="tab"
      aria-selected={isActive}
    >
      {label}
    </button>
  );

  return (
    <>
      <div
        className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-slate-900 p-4 sm:p-6 py-8 sm:py-4"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)`,
          backgroundSize: '20px 20px',
        }}
      >
        <div className="w-full max-w-[calc(100vw-2rem)] sm:max-w-sm bg-slate-900/70 backdrop-blur-lg rounded-xl shadow-2xl overflow-hidden border border-slate-700">
          <div className="p-5 sm:p-8">
            <div className="flex justify-center mb-5 sm:mb-6">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
                <div className="p-2.5 sm:p-3 bg-slate-800 rounded-lg border border-slate-700 shrink-0">
                  <IconCustomers className="w-8 h-8 sm:w-6 sm:h-6 text-white" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white text-center sm:text-left">CRM Login</h1>
              </div>
            </div>

            {sessionLostMessage && (
              <p className="text-sm text-amber-200 bg-amber-900/40 border border-amber-600/50 p-3 rounded-md mb-4">
                {sessionLostMessage}
              </p>
            )}

            <>
            <div className="bg-slate-800/50 rounded-lg p-1 flex mb-5 sm:mb-6 border border-slate-700">
              <TabButton
                label="Email & Password"
                isActive={activeTab === 'password'}
                onClick={() => { setActiveTab('password'); setError(null); setMessage(null); }}
              />
              <TabButton
                label="Magic Link"
                isActive={activeTab === 'magiclink'}
                onClick={() => { setActiveTab('magiclink'); setError(null); setMessage(null); }}
              />
            </div>

            {activeTab === 'password' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 bg-slate-900/50 border border-slate-600 rounded-md shadow-sm text-white placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm"
                  />
                </div>

                <div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                    <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                      Password
                    </label>
                    <button type="button" onClick={() => setIsResetModalOpen(true)} className="text-xs font-medium text-blue-500 hover:text-blue-400 text-left touch-manipulation py-1 -my-1">
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative mt-1">
                    <input
                      id="password"
                      name="password"
                      type={isPasswordVisible ? 'text' : 'password'}
                      autoComplete='current-password'
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 bg-slate-900/50 border border-slate-600 rounded-md shadow-sm text-white placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200 touch-manipulation min-w-[44px]"
                      aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                    >
                      {isPasswordVisible ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-sm text-red-400 bg-red-900/50 p-3 rounded-md break-words">{error}</p>}

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-3 sm:py-2.5 px-4 min-h-[44px] sm:min-h-0 border border-transparent rounded-[5px] shadow-sm text-sm font-medium text-white bg-[#191974] hover:bg-[#13135c] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500 disabled:bg-slate-500 disabled:cursor-not-allowed touch-manipulation"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : 'Sign In'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleMagicLink} className="space-y-4">
                {message ? (
                  <p className="text-sm text-center text-green-400 bg-green-900/50 p-3 rounded-md break-words">{message}</p>
                ) : (
                  <>
                    <div>
                      <label htmlFor="magiclink-email" className="block text-sm font-medium text-slate-300">
                        Email
                      </label>
                      <p className="text-xs text-slate-500 mb-2">We'll email you a magic link for a password-free sign in.</p>
                      <input
                        id="magiclink-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email address"
                        className="mt-1 block w-full px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 bg-slate-900/50 border border-slate-600 rounded-md shadow-sm text-white placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm"
                      />
                    </div>

                    {error && <p className="text-sm text-red-400 bg-red-900/50 p-3 rounded-md break-words">{error}</p>}

                    <div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-3 sm:py-2.5 px-4 min-h-[44px] sm:min-h-0 border border-transparent rounded-[5px] shadow-sm text-sm font-medium text-white bg-[#191974] hover:bg-[#13135c] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500 disabled:bg-slate-500 disabled:cursor-not-allowed touch-manipulation"
                      >
                        {loading ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : '✉️ Send Magic Link'}
                      </button>
                    </div>
                  </>
                )}
              </form>
            )}

              </>
            }

          </div>
        </div>
      </div>
      {isResetModalOpen && <ResetPasswordModal onClose={() => setIsResetModalOpen(false)} />}
    </>
  );
};

export default AuthPage;
