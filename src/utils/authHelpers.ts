import { AppUserProfile, NavigationSection } from '../types/report';

export interface FirebaseAuthConfigShape {
  projectId?: string;
  appId?: string;
  apiKey?: string;
  authDomain?: string;
  firestoreDatabaseId?: string;
}

export interface GoogleAuthConfigValidation {
  configured: boolean;
  missingFields: string[];
  explanation: string | null;
}

/**
 * Validates that the required Google Cloud / Firebase Authentication configuration
 * fields are present without inventing or hardcoding fallback credentials.
 */
export function validateGoogleAuthConfig(
  config: FirebaseAuthConfigShape | null | undefined
): GoogleAuthConfigValidation {
  if (!config || typeof config !== 'object') {
    return {
      configured: false,
      missingFields: ['projectId', 'appId', 'apiKey', 'authDomain'],
      explanation:
        'Google authentication is not configured: firebase-applet-config.json is missing.',
    };
  }

  const requiredFields: (keyof FirebaseAuthConfigShape)[] = [
    'projectId',
    'appId',
    'apiKey',
    'authDomain',
  ];

  const missingFields = requiredFields.filter((key) => {
    const val = config[key];
    return typeof val !== 'string' || val.trim().length === 0;
  });

  if (missingFields.length > 0) {
    return {
      configured: false,
      missingFields,
      explanation: `Google authentication configuration is incomplete. Missing required fields in firebase-applet-config.json: ${missingFields.join(', ')}.`,
    };
  }

  return {
    configured: true,
    missingFields: [],
    explanation: null,
  };
}

/**
 * Maps a Firebase Auth User object to the application's AppUserProfile model.
 */
export function mapFirebaseUserToProfile(user: {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  emailVerified?: boolean;
}): AppUserProfile {
  const email = user.email || '';
  const fallbackName = email ? email.split('@')[0] : 'Research Analyst';
  return {
    uid: user.uid,
    displayName: user.displayName?.trim() || fallbackName,
    email,
    photoURL: user.photoURL || null,
    emailVerified: Boolean(user.emailVerified),
    authProviderLabel: 'Google Cloud Auth',
  };
}

/**
 * Translates Firebase Google popup authentication errors into clean, actionable messages
 * while distinguishing user-cancelled popups from configuration/network errors.
 */
export function formatGoogleAuthError(error: unknown): {
  cancelled: boolean;
  code: string;
  message: string;
} {
  const errObj = error as { code?: string; message?: string } | null;
  const code = typeof errObj?.code === 'string' ? errObj.code : 'auth/unknown';

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return {
      cancelled: true,
      code,
      message: 'Google sign-in was cancelled. Click "Continue with Google" to try again.',
    };
  }

  if (code === 'auth/popup-blocked') {
    return {
      cancelled: false,
      code,
      message:
        'The Google sign-in window was blocked by your browser. Please allow popups for this site and try again.',
    };
  }

  if (code === 'auth/network-request-failed') {
    return {
      cancelled: false,
      code,
      message:
        'Network error while connecting to Google Authentication. Please check your connection and try again.',
    };
  }

  if (code === 'auth/unauthorized-domain') {
    return {
      cancelled: false,
      code,
      message:
        'This domain is not authorized for OAuth operations in your Firebase project settings.',
    };
  }

  const rawMessage = typeof errObj?.message === 'string' ? errObj.message.trim() : '';
  return {
    cancelled: false,
    code,
    message:
      rawMessage ||
      'Unable to complete Google sign-in. Please verify your Google account and try again.',
  };
}

const PROTECTED_SECTIONS: ReadonlySet<NavigationSection> = new Set([
  'dashboard',
  'explore',
  'upload',
  'chat',
  'compare',
  'atlas3d',
  'insights',
  'tables',
  'summary',
  'finetune',
  'settings',
]);

/**
 * Verifies whether a route/section requires an authenticated Google user session.
 * Public routes ('home' and 'auth') return false.
 */
export function isRouteProtected(section: NavigationSection): boolean {
  return PROTECTED_SECTIONS.has(section);
}

/**
 * Determines whether the current session is authorized to access a route.
 * Public routes ('home' and 'auth') are always accessible without login.
 */
export function canAccessProtectedRoute(
  user: AppUserProfile | null | undefined,
  section: NavigationSection
): boolean {
  if (!isRouteProtected(section)) {
    return true;
  }
  return Boolean(user && typeof user.uid === 'string' && user.uid.trim().length > 0);
}

/**
 * Resolves the initial section when the website opens:
 * - Unauthenticated visitors always land on the public homepage ('home').
 * - Authenticated users land on their private dashboard ('dashboard').
 */
export function resolveInitialSection(
  user: AppUserProfile | null | undefined
): NavigationSection {
  return canAccessProtectedRoute(user, 'dashboard') ? 'dashboard' : 'home';
}

/**
 * Resolves any navigation transition while enforcing route protection:
 * - Public homepage ('home') is always accessible.
 * - Clicking Sign In / Get Started ('auth') opens the dedicated Google auth screen
 *   (or redirects straight to 'dashboard' if already authenticated).
 * - Attempting to access any protected section while unauthenticated redirects to 'auth'.
 */
export function resolveNavigationTarget(
  targetSection: NavigationSection,
  user: AppUserProfile | null | undefined
): NavigationSection {
  if (targetSection === 'home') {
    return 'home';
  }
  const isAuthenticated = Boolean(
    user && typeof user.uid === 'string' && user.uid.trim().length > 0
  );
  if (targetSection === 'auth') {
    return isAuthenticated ? 'dashboard' : 'auth';
  }
  if (isRouteProtected(targetSection) && !isAuthenticated) {
    return 'auth';
  }
  return targetSection;
}

