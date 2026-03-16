import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { validatePasswordStrength, PASSWORD_HINT, PASSWORD_MIN_LENGTH } from '../lib/passwordValidation';
import { IconEye, IconEyeOff } from '../constants';
import { useAuth } from '../contexts/AuthProvider';
import { useRouter } from '../contexts/RouterProvider';

/**
 * Dedicated full-screen page for setting a new password.
 * Used for: (1) Supabase reset-password link (recovery) — user must complete before accessing CRM;
 *           (2) In-app "Change password" from Settings — optional, can go back.
 * Styled like the authentication page (blank, no sidebar/header).
 */
const ResetPasswordPage: React.FC<{ isRecovery?: boolean }> = ({ isRecovery = false }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { onPasswordRecoveryComplete } = useAuth();
  const { navigate } = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    const pwdError = validatePasswordStrength(password);
    if (pwdError) {
      setError(pwdError);
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const again = validatePasswordStrength(password);
      if (again) {
        setError(again);
        setLoading(false);
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setMessage('Your password has been updated successfully.');
      setPassword('');
      setConfirmPassword('');

      if (isRecovery) {
        onPasswordRecoveryComplete();
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        setTimeout(() => navigate('/settings'), 1500);
      }
    } catch (err: any) {
      if (err?.message?.includes('weaker than')) {
        setError('This password is too weak. Please choose a stronger one.');
      } else {
        setError(err?.message || 'Failed to update password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-slate-900 p-4 sm:p-6 py-8 sm:py-4"
      style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)`,
        backgroundSize: '20px 20px',
      }}
    >
      <div className="w-full max-w-[calc(100vw-2rem)] sm:max-w-sm bg-slate-900/70 backdrop-blur-lg rounded-xl shadow-2xl overflow-hidden border border-slate-700 p-5 sm:p-8">
        <div className="flex justify-center mb-5 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-white text-center">
            {isRecovery ? 'Set new password' : 'Change password'}
          </h1>
        </div>
        {isRecovery && (
          <p className="text-sm text-slate-300 mb-4 text-center">
            You’re resetting your password. Set a new password below to access the CRM.
          </p>
        )}

        {message ? (
          <p className="text-sm text-green-400 bg-green-900/50 p-3 rounded-md text-center">{message}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-slate-300">
                New password
              </label>
              <p className="text-xs text-slate-500 mt-0.5 mb-1">{PASSWORD_HINT}</p>
              <div className="relative mt-1">
                <input
                  id="new-password"
                  name="password"
                  type={isPasswordVisible ? 'text' : 'password'}
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 bg-slate-900/50 border border-slate-600 rounded-md shadow-sm text-white placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                  aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                >
                  {isPasswordVisible ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-300">
                Confirm new password
              </label>
              <div className="relative mt-1">
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type={isConfirmVisible ? 'text' : 'password'}
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 bg-slate-900/50 border border-slate-600 rounded-md shadow-sm text-white placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setIsConfirmVisible(!isConfirmVisible)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                  aria-label={isConfirmVisible ? 'Hide password' : 'Show password'}
                >
                  {isConfirmVisible ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-400 bg-red-900/50 p-3 rounded-md break-words">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 sm:py-2 px-4 min-h-[44px] sm:min-h-0 border border-transparent rounded-[5px] shadow-sm text-sm font-medium text-white bg-[#191974] hover:bg-[#13135c] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-500 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                'Update password'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
