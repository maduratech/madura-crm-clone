import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { validatePasswordStrength, PASSWORD_HINT, PASSWORD_MIN_LENGTH } from '../lib/passwordValidation';
import { IconEye, IconEyeOff } from '../constants';

const ResetPasswordForm: React.FC<{ title: string; onSuccess: () => void; }> = ({ title, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
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
      // Validate again before sending (defence in depth)
      const again = validatePasswordStrength(password);
      if (again) {
        setError(again);
        setLoading(false);
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setMessage('Your password has been updated successfully!');
      setPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        setMessage(null); // Clear message
        onSuccess();
      }, 2000);

    } catch (err: any) {
      if (err.message.includes('weaker than')) {
        setError('This password is too weak. Please choose a stronger one.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm bg-white p-6 rounded-lg shadow-lg relative">
      <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-4 mb-6">{title}</h2>

      {message ? (
        <p className="text-center text-sm text-green-800 bg-green-100 p-4 rounded-md">{message}</p>
      ) : (
        <form onSubmit={handlePasswordUpdate} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-slate-700">
              New Password
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
                className="block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
              >
                {isPasswordVisible ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700">
              Confirm New Password
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
                className="block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setIsConfirmVisible(!isConfirmVisible)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
              >
                {isConfirmVisible ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-[5px] shadow-sm text-sm font-medium text-white bg-[#191974] hover:bg-[#13135c] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : 'Update Password'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ResetPasswordForm;