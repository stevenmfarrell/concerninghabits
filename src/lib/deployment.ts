// Whether this server is someone's own (self-hosted, the default) or the hosted version at
// concerninghabits.com, set with DEPLOYMENT_MODE. Everything that differs between the two asks here
// rather than reading the setting itself, so the differences are all easy to find.

const MODES = ['selfhost', 'cloud'] as const;
export type DeploymentMode = (typeof MODES)[number];

// Read on each request rather than once, so it follows the environment it's given. An unknown value
// is an error rather than a fallback: the hosted version running as a self-hosted server by mistake
// would offer first-time setup and the admin's pages to strangers. Checked at startup too (see
// instrumentation.ts), so a typo stops the server before it serves anything.
export function deploymentMode(): DeploymentMode {
  const set = process.env.DEPLOYMENT_MODE?.trim().toLowerCase();
  if (!set) return 'selfhost';
  if (!(MODES as readonly string[]).includes(set)) {
    throw new Error(`DEPLOYMENT_MODE "${set}" isn't one of: ${MODES.join(', ')}.`);
  }
  return set as DeploymentMode;
}

export const isCloud = () => deploymentMode() === 'cloud';

// How people can sign in on this server, for the sign-in page and the apps (see /api/meta). Only
// passwords for now; the hosted version is to sign in with Google instead (issue #19).
export function signInMethods(): ('password' | 'google')[] {
  return ['password'];
}
