import { AppUserProfile, NavigationSection } from '../types/report';

const DEFAULT_WORKSPACE_PROFILE: AppUserProfile = {
  uid: 'ws_research_analyst',
  displayName: 'Research Analyst',
  email: 'workspace@reportnavigator.local',
};

/**
 * Returns the default local workspace profile for internal features that tag
 * reports or preferences with a workspace identifier (without Google Authentication).
 */
export function getDefaultWorkspaceProfile(): AppUserProfile {
  return { ...DEFAULT_WORKSPACE_PROFILE };
}

/**
 * All sections of Report Navigator AI are directly accessible without login.
 */
export function isRouteProtected(_section: NavigationSection): boolean {
  return false;
}

/**
 * All routes are directly accessible without requiring Google Sign-In or any login gate.
 */
export function canAccessProtectedRoute(
  _user: AppUserProfile | null | undefined,
  _section: NavigationSection
): boolean {
  return true;
}

/**
 * Resolves the initial section when the application opens:
 * Opens the Dashboard directly without requiring sign-in.
 */
export function resolveInitialSection(
  _user?: AppUserProfile | null | undefined
): NavigationSection {
  return 'dashboard';
}

/**
 * Resolves any navigation transition directly to the requested target section
 * without forced login redirects.
 */
export function resolveNavigationTarget(
  targetSection: NavigationSection,
  _user?: AppUserProfile | null | undefined
): NavigationSection {
  return targetSection;
}
