import React, { useState } from 'react';
import { AlertCircle, ArrowLeft, Shield } from 'lucide-react';
import { AppUserProfile } from '../types/report';
import { googleAuthConfigStatus, signInWithGoogle } from '../firebase';
import { formatGoogleAuthError } from '../utils/authHelpers';

interface AuthScreenProps {
  onSuccess: (profile: AppUserProfile) => void;
  onBackToHome?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess, onBackToHome }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    googleAuthConfigStatus.configured ? null : googleAuthConfigStatus.explanation
  );

  const handleGoogleLogin = async () => {
    if (!googleAuthConfigStatus.configured) {
      setErrorMessage(
        googleAuthConfigStatus.explanation ||
          'Google authentication is not configured in firebase-applet-config.json.'
      );
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const profile = await signInWithGoogle();
      if (profile) {
        onSuccess(profile);
      }
    } catch (error: unknown) {
      const formatted = formatGoogleAuthError(error);
      setErrorMessage(formatted.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-6 py-12"
      data-testid="google-auth-screen"
    >
      <div className="w-full max-w-lg">
        {onBackToHome && (
          <div className="mb-4">
            <button
              type="button"
              onClick={onBackToHome}
              data-testid="back-to-home-btn"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Back to Homepage</span>
            </button>
          </div>
        )}

        <div className="w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xl shadow-slate-900/5 dark:shadow-black/40 p-8 sm:p-10 text-center">
          {/* Report Navigator AI Logo & Shield Icon */}
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 mb-3">
              <Shield className="w-6 h-6" aria-hidden="true" />
            </div>
            <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              Report Navigator AI
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome to Report Navigator AI
          </h1>

          {/* Subtitle */}
          <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Your AI-powered research assistant.
          </p>

          {/* Clean Error Alert (Only visible if login is cancelled or fails) */}
          {errorMessage && (
            <div
              role="alert"
              data-testid="auth-error-banner"
              className="mt-6 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5 text-left text-xs text-red-700 dark:text-red-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Prominent Centered Google Authentication Button */}
          <div className="mt-8">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isSubmitting || !googleAuthConfigStatus.configured}
              data-testid="continue-with-google-btn"
              className="w-full py-3.5 px-5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 active:bg-slate-100 text-slate-900 dark:text-white font-semibold text-sm border border-slate-300 dark:border-slate-700 shadow-sm hover:shadow transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {/* Official Google 4-Color "G" Logo */}
              <svg
                className="w-5 h-5 shrink-0"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  fill="#4285F4"
                  d="M23.49 12.275c0-.85-.075-1.675-.215-2.475H12v4.685h6.445c-.28 1.5-1.125 2.775-2.395 3.63v3.015h3.875c2.265-2.085 3.565-5.16 3.565-8.855z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.955-1.075 7.94-2.905l-3.875-3.015c-1.075.72-2.45 1.145-4.065 1.145-3.125 0-5.77-2.11-6.715-4.945H1.28v3.11C3.255 21.315 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.285 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.61H1.28C.465 8.23 0 10.065 0 12s.465 3.77 1.28 5.39l4.005-3.11z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.775c1.76 0 3.34.605 4.585 1.795l3.44-3.44C17.95 1.19 15.235 0 12 0 7.31 0 3.255 2.685 1.28 6.61l4.005 3.11C6.23 6.885 8.875 4.775 12 4.775z"
                />
              </svg>
              <span>{isSubmitting ? 'Connecting to Google...' : 'Continue with Google'}</span>
            </button>
          </div>

          {/* Small Privacy Message */}
          <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
            Secure sign-in powered by Google.
          </p>
        </div>
      </div>
    </main>
  );
};
