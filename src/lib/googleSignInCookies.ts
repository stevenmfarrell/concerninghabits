// The short-lived cookies that carry a Google sign-in from its start to Google's callback (see
// src/app/api/auth/google): the state that ties the callback to this browser, the PKCE code
// verifier, and where to go afterwards. Only sent to those two routes, and gone after ten minutes.

import { cookies, headers } from 'next/headers';
import { isSecureCookie } from './auth';

const STATE = 'google_oauth_state';
const CODE_VERIFIER = 'google_code_verifier';
const RETURN_TO = 'google_return_to';
const PATH = '/api/auth/google';
const MAX_AGE_S = 10 * 60;

export async function rememberGoogleSignIn(state: string, codeVerifier: string, returnTo: string | null) {
  const [jar, headerStore] = await Promise.all([cookies(), headers()]);
  // Lax, like the session cookie: Google sends people back with a top-level GET, which Lax cookies
  // go along with
  const options = {
    httpOnly: true,
    secure: isSecureCookie(process.env.COOKIE_SECURE, headerStore.get('x-forwarded-proto')),
    sameSite: 'lax' as const,
    path: PATH,
    maxAge: MAX_AGE_S,
  };
  jar.set(STATE, state, options);
  jar.set(CODE_VERIFIER, codeVerifier, options);
  if (returnTo) jar.set(RETURN_TO, returnTo, options);
}

// What was remembered, clearing it: each sign-in's cookies are good for one callback
export async function takeGoogleSignIn() {
  const jar = await cookies();
  const taken = { state: jar.get(STATE)?.value, codeVerifier: jar.get(CODE_VERIFIER)?.value, returnTo: jar.get(RETURN_TO)?.value ?? null };
  for (const name of [STATE, CODE_VERIFIER, RETURN_TO]) jar.set(name, '', { path: PATH, maxAge: 0 });
  return taken;
}
