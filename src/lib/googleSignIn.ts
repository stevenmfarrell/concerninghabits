// Signing in with Google, on the hosted version (see deployment.ts). Google proves who someone is
// with an ID token; from there it's the same session as signing in with a password (see auth.ts).
// The routes are src/app/api/auth/google. Server-only.

import { decodeIdToken, Google } from 'arctic';
import { prisma } from './prisma';
import { appUrl } from './deployment';
import { seedDefaultCategories } from './defaultCategories';
import { RETURN_TO_PARAM } from './returnTo';

export const GOOGLE_CALLBACK_PATH = '/api/auth/google/callback';
// Who the person is, and nothing more: no access to anything in their Google account
export const GOOGLE_SCOPES = ['openid', 'email', 'profile'];
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export function googleClient() {
  return new Google(process.env.GOOGLE_CLIENT_ID ?? '', process.env.GOOGLE_CLIENT_SECRET ?? '', appUrl() + GOOGLE_CALLBACK_PATH);
}

// Why signing in with Google didn't work, as a code for the sign-in page to explain (see
// SIGN_IN_ERRORS in the login page)
export type GoogleSignInError = 'cancelled' | 'expired' | 'failed' | 'unverified' | 'email-taken' | 'not-allowed' | 'busy';

// The sign-in page, saying why signing in didn't work, and keeping where to go once it does
export function loginUrl(error: GoogleSignInError, returnTo: string | null) {
  const url = new URL('/login', appUrl());
  url.searchParams.set('error', error);
  if (returnTo) url.searchParams.set(RETURN_TO_PARAM, returnTo);
  return url;
}

export class GoogleSignInFailure extends Error {
  constructor(readonly code: GoogleSignInError, message: string) {
    super(message);
  }
}

export interface GoogleAccount {
  subject: string;
  email: string;
  name: string;
}

// The account an ID token is for, after checking it's from Google, for this app, still current, and
// for a verified email. The token came straight from Google's token endpoint over https (see
// validateAuthorizationCode), which OpenID Connect accepts in place of checking its signature.
export function googleAccountFrom(idToken: string, now = new Date()): GoogleAccount {
  let claims: Record<string, unknown>;
  try {
    claims = decodeIdToken(idToken) as Record<string, unknown>;
  } catch {
    throw new GoogleSignInFailure('failed', 'Google\'s ID token couldn\'t be read');
  }
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!GOOGLE_ISSUERS.includes(String(claims.iss))) throw new GoogleSignInFailure('failed', `The ID token isn't from Google (${claims.iss})`);
  if (!audiences.includes(process.env.GOOGLE_CLIENT_ID)) throw new GoogleSignInFailure('failed', 'The ID token is for a different app');
  if (typeof claims.exp !== 'number' || claims.exp * 1000 < now.getTime()) throw new GoogleSignInFailure('failed', 'The ID token has expired');
  if (typeof claims.sub !== 'string' || !claims.sub) throw new GoogleSignInFailure('failed', 'The ID token has no account id');
  if (typeof claims.email !== 'string' || claims.email_verified !== true) {
    throw new GoogleSignInFailure('unverified', 'The Google account\'s email isn\'t verified');
  }

  const email = claims.email.trim().toLowerCase();
  const name = [claims.name, claims.given_name].find((n): n is string => typeof n === 'string' && n.trim() !== '')?.trim() ?? email.split('@')[0];
  return { subject: claims.sub, email, name };
}

// Whether a Google account's email may sign in, from ALLOWED_EMAILS: a comma-separated list of
// addresses, for keeping the hosted version to the people invited before it opens to everyone.
// Unset, anyone with a Google account can sign in.
export function emailAllowed(email: string) {
  const allowed = (process.env.ALLOWED_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  return allowed.length === 0 || allowed.includes(email);
}

// The user a Google account signs in as, making one on its first sign-in, with the default
// categories, as setting up a server does for its first user. Found by Google's id for the account,
// never by email. An email already on another account isn't linked to it automatically (that would
// let whoever controls the email take the account over), so it's refused instead. An email that
// isn't allowed (see emailAllowed) is refused before anything else, so taking someone off the list
// stops them signing in again, though it doesn't end a session they already have.
export async function userForGoogleAccount(account: GoogleAccount) {
  if (!emailAllowed(account.email)) {
    throw new GoogleSignInFailure('not-allowed', `${account.email} isn't in ALLOWED_EMAILS`);
  }
  const identity = await prisma.identity.findUnique({
    where: { provider_subject: { provider: 'google', subject: account.subject } },
    include: { user: true },
  });
  if (identity) {
    if (identity.email !== account.email) await prisma.identity.update({ where: { id: identity.id }, data: { email: account.email } });
    return identity.user;
  }

  if (await prisma.user.findUnique({ where: { email: account.email }, select: { id: true } })) {
    throw new GoogleSignInFailure('email-taken', `${account.email} already has an account that isn't linked to this Google account`);
  }
  const user = await prisma.user.create({
    data: {
      name: account.name,
      email: account.email,
      identities: { create: { provider: 'google', subject: account.subject, email: account.email } },
    },
  });
  await seedDefaultCategories(user.id);
  return user;
}
