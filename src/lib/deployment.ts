// Whether this server is someone's own (self-hosted, the default) or the hosted version at
// concerninghabits.com, set with DEPLOYMENT_MODE. Everything that differs between the two asks here
// rather than reading the setting itself, so the differences are all easy to find.

const MODES = ['selfhost', 'cloud'] as const;
export type DeploymentMode = (typeof MODES)[number];

// Read on each request rather than once, so it follows the environment it's given. An unknown value
// is an error rather than a fallback: the hosted version running as a self-hosted server by mistake
// would offer first-time setup and the admin's pages to strangers. Checked at startup too (see
// deploymentProblem), so a typo stops the server before it serves anything.
export function deploymentMode(): DeploymentMode {
  const set = process.env.DEPLOYMENT_MODE?.trim().toLowerCase();
  if (!set) return 'selfhost';
  if (!(MODES as readonly string[]).includes(set)) {
    throw new Error(`DEPLOYMENT_MODE "${set}" isn't one of: ${MODES.join(', ')}.`);
  }
  return set as DeploymentMode;
}

export const isCloud = () => deploymentMode() === 'cloud';

// How people can sign in on this server, for the sign-in page and the apps (see /api/meta): a
// password on a self-hosted server, Google on the hosted version, which stores no passwords.
export function signInMethods(): ('password' | 'google')[] {
  return isCloud() ? ['google'] : ['password'];
}

// The address people reach the hosted version at (e.g. https://app.concerninghabits.com), from
// APP_URL, without a trailing slash: Google sends people back to it after signing in, and requests
// can't be trusted to say it themselves.
export function appUrl() {
  return process.env.APP_URL?.trim().replace(/\/+$/, '') ?? '';
}

// The settings the hosted version can't run without
const CLOUD_SETTINGS = ['APP_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];

// Why this server can't start as configured, or null when it can: an unknown DEPLOYMENT_MODE, or
// the hosted version missing what it needs to sign people in. Checked at startup (see
// instrumentation.ts), so the server stops rather than running without a way in.
export function deploymentProblem(): string | null {
  let mode: DeploymentMode;
  try {
    mode = deploymentMode();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  if (mode !== 'cloud') return null;

  const missing = CLOUD_SETTINGS.filter(name => !process.env[name]?.trim());
  if (missing.length > 0) return `DEPLOYMENT_MODE=cloud needs ${missing.join(', ')}.`;
  try {
    const url = new URL(appUrl());
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return `APP_URL must be an https address (or localhost, for development), not ${appUrl()}.`;
    }
  } catch {
    return `APP_URL isn't an address: ${appUrl()}.`;
  }
  return null;
}
