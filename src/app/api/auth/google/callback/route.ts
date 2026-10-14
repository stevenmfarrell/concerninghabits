import { NextResponse, type NextRequest } from 'next/server';
import { createSession } from '@/lib/auth';
import { appUrl, signInMethods } from '@/lib/deployment';
import { googleAccountFrom, googleClient, GoogleSignInFailure, loginUrl, userForGoogleAccount } from '@/lib/googleSignIn';
import { takeGoogleSignIn } from '@/lib/googleSignInCookies';
import { safeReturnTo } from '@/lib/returnTo';

// Where Google sends the browser back after someone picks an account (see ../route.ts). Checks the
// callback belongs to the sign-in this browser started, trades its code for Google's ID token, and
// signs in as that account's user (making one the first time), with the same session as signing
// in with a password. Anything wrong goes back to the sign-in page, saying why.
export async function GET(request: NextRequest) {
  if (!signInMethods().includes('google')) return new Response('Not found', { status: 404 });
  const params = request.nextUrl.searchParams;
  const started = await takeGoogleSignIn();
  const returnTo = safeReturnTo(started.returnTo);

  // e.g. access_denied, when they backed out of Google's account picker
  if (params.get('error')) return NextResponse.redirect(loginUrl('cancelled', returnTo));
  const code = params.get('code');
  // A missing or different state means this browser didn't start this sign-in, or started it too
  // long ago for its cookies to last
  if (!code || !started.state || !started.codeVerifier || params.get('state') !== started.state) {
    return NextResponse.redirect(loginUrl('expired', returnTo));
  }

  let userId: string;
  try {
    const tokens = await googleClient().validateAuthorizationCode(code, started.codeVerifier);
    userId = (await userForGoogleAccount(googleAccountFrom(tokens.idToken()))).id;
  } catch (error) {
    if (error instanceof GoogleSignInFailure) {
      console.warn(`Google sign-in refused: ${error.message}`);
      return NextResponse.redirect(loginUrl(error.code, returnTo));
    }
    console.error('Google sign-in failed', error);
    return NextResponse.redirect(loginUrl('failed', returnTo));
  }

  await createSession(userId);
  return NextResponse.redirect(new URL(returnTo ?? '/', appUrl()));
}
