import { NextResponse, type NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { generateCodeVerifier, generateState } from 'arctic';
import { signInMethods } from '@/lib/deployment';
import { GOOGLE_SCOPES, googleClient, loginUrl } from '@/lib/googleSignIn';
import { rememberGoogleSignIn } from '@/lib/googleSignInCookies';
import { clientIp, countRequest } from '@/lib/rateLimit';
import { RETURN_TO_PARAM, safeReturnTo } from '@/lib/returnTo';

// Sign-ins started per address in a window, well over anyone signing in by hand
const MAX_STARTS = 30;
const WINDOW_MS = 15 * 60 * 1000;

// Starts signing in with Google (the sign-in page's button): sends the browser to Google's account
// picker, remembering in short-lived cookies what the callback needs to finish (see
// googleSignInCookies.ts). `?returnTo=` is where to go once signed in.
export async function GET(request: NextRequest) {
  if (!signInMethods().includes('google')) return new Response('Not found', { status: 404 });
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get(RETURN_TO_PARAM));
  if (!(await countRequest(`google-sign-in:${clientIp(await headers())}`, MAX_STARTS, WINDOW_MS))) {
    return NextResponse.redirect(loginUrl('busy', returnTo));
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = googleClient().createAuthorizationURL(state, codeVerifier, GOOGLE_SCOPES);
  // Always offer the choice of account, rather than signing in as whichever one is signed in to Google
  url.searchParams.set('prompt', 'select_account');
  await rememberGoogleSignIn(state, codeVerifier, returnTo);
  return NextResponse.redirect(url);
}
