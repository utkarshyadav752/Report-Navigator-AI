import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessProtectedRoute,
  getDefaultWorkspaceProfile,
  isRouteProtected,
  resolveInitialSection,
  resolveNavigationTarget,
} from './authHelpers';
import { NavigationSection } from '../types/report';

test('WORKSPACE ACCESS TEST 1 — Application opens directly to Dashboard without requiring Google Sign-In', () => {
  assert.equal(resolveInitialSection(), 'dashboard');
  assert.equal(resolveInitialSection(null), 'dashboard');
});

test('WORKSPACE ACCESS TEST 2 — All application sections are directly accessible without forced login redirects', () => {
  const allSections: NavigationSection[] = [
    'home',
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
  ];

  for (const section of allSections) {
    assert.equal(isRouteProtected(section), false, `Section ${section} must not require login`);
    assert.equal(
      canAccessProtectedRoute(null, section),
      true,
      `Section ${section} must be directly accessible without authentication`
    );
    assert.equal(
      resolveNavigationTarget(section, null),
      section,
      `Navigation to ${section} must resolve directly without redirect`
    );
  }
});

test('WORKSPACE ACCESS TEST 3 — Default non-Google workspace profile provides clean identifier for internal features', () => {
  const profile = getDefaultWorkspaceProfile();
  assert.equal(profile.uid, 'ws_research_analyst');
  assert.equal(profile.displayName, 'Research Analyst');
  assert.ok(!profile.email.includes('google'));
});
