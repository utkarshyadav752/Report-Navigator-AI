import { test } from 'node:test';
import assert from 'node:assert/strict';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  canAccessProtectedRoute,
  formatGoogleAuthError,
  isRouteProtected,
  mapFirebaseUserToProfile,
  resolveInitialSection,
  resolveNavigationTarget,
  validateGoogleAuthConfig,
} from './authHelpers';
import { NavigationSection } from '../types/report';

test('AUTH TEST 1 — Existing firebase-applet-config.json passes Google Cloud Auth validation without inventing credentials', () => {
  const status = validateGoogleAuthConfig(firebaseConfig);
  assert.equal(status.configured, true);
  assert.deepEqual(status.missingFields, []);
  assert.equal(status.explanation, null);
});

test('AUTH TEST 2 — Missing or incomplete config is rejected with an explicit explanation of missing fields', () => {
  const nullStatus = validateGoogleAuthConfig(null);
  assert.equal(nullStatus.configured, false);
  assert.ok(nullStatus.explanation?.includes('firebase-applet-config.json is missing'));

  const partialStatus = validateGoogleAuthConfig({
    projectId: 'demo-proj',
    apiKey: '',
  });
  assert.equal(partialStatus.configured, false);
  assert.ok(partialStatus.missingFields.includes('apiKey'));
  assert.ok(partialStatus.missingFields.includes('authDomain'));
  assert.ok(partialStatus.missingFields.includes('appId'));
  assert.ok(partialStatus.explanation?.includes('Missing required fields'));
});

test('AUTH TEST 3 — Cancelled Google popup and authentication errors are formatted cleanly without simulating login', () => {
  const closedErr = formatGoogleAuthError({ code: 'auth/popup-closed-by-user' });
  assert.equal(closedErr.cancelled, true);
  assert.ok(closedErr.message.includes('Google sign-in was cancelled'));

  const blockedErr = formatGoogleAuthError({ code: 'auth/popup-blocked' });
  assert.equal(blockedErr.cancelled, false);
  assert.ok(blockedErr.message.includes('blocked by your browser'));

  const networkErr = formatGoogleAuthError({ code: 'auth/network-request-failed' });
  assert.equal(networkErr.cancelled, false);
  assert.ok(networkErr.message.includes('Network error'));
});

test('AUTH TEST 4 — Public homepage opens by default without login; Sign In / Get Started opens dedicated auth page; private routes are protected', () => {
  // 1. Public Homepage is publicly accessible without login
  assert.equal(isRouteProtected('home'), false);
  assert.equal(canAccessProtectedRoute(null, 'home'), true);
  assert.equal(resolveInitialSection(null), 'home');
  assert.equal(resolveNavigationTarget('home', null), 'home');

  // 2. Clicking Sign In / Get Started navigates to the dedicated Google Auth page ('auth')
  assert.equal(isRouteProtected('auth'), false);
  assert.equal(resolveNavigationTarget('auth', null), 'auth');

  // 3. Unauthenticated user attempting to access any private route is routed to 'auth'
  const protectedSections: NavigationSection[] = [
    'dashboard',
    'explore',
    'upload',
    'chat',
    'atlas3d',
    'insights',
    'tables',
    'summary',
    'settings',
  ];

  for (const section of protectedSections) {
    assert.equal(isRouteProtected(section), true, `Section ${section} must be protected`);
    assert.equal(
      canAccessProtectedRoute(null, section),
      false,
      `Unauthenticated user must not access ${section}`
    );
    assert.equal(
      resolveNavigationTarget(section, null),
      'auth',
      `Unauthenticated navigation to ${section} must redirect to dedicated auth screen`
    );
  }

  // 4. After successful Google authentication, user is redirected to Dashboard and all private routes unlock
  const profile = mapFirebaseUserToProfile({
    uid: 'google_uid_12345',
    displayName: 'Dr. Kavita Rao',
    email: 'kavita.rao@mospi.gov.in',
    photoURL: 'https://lh3.googleusercontent.com/a/default-user',
    emailVerified: true,
  });

  assert.equal(profile.uid, 'google_uid_12345');
  assert.equal(profile.displayName, 'Dr. Kavita Rao');
  assert.equal(profile.email, 'kavita.rao@mospi.gov.in');
  assert.equal(profile.authProviderLabel, 'Google Cloud Auth');
  assert.equal(resolveInitialSection(profile), 'dashboard');
  assert.equal(resolveNavigationTarget('auth', profile), 'dashboard');

  for (const section of protectedSections) {
    assert.equal(
      canAccessProtectedRoute(profile, section),
      true,
      `Authenticated Google user must access ${section}`
    );
    assert.equal(
      resolveNavigationTarget(section, profile),
      section,
      `Authenticated Google user can navigate directly to ${section}`
    );
  }
});

