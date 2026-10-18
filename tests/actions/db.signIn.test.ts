import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { cookieJar } from '../setup';
import { login } from '@/app/actions/auth';
import { deploymentProblem, signInMethods } from '@/lib/deployment';
import { googleAccountFrom, GoogleSignInFailure, userForGoogleAccount } from '@/lib/googleSignIn';
import { GET as startGoogle } from '@/app/api/auth/google/route';
import { GET as googleCallback } from '@/app/api/auth/google/callback/route';

// Google itself: only trading the callback's code for tokens is faked, the rest of Arctic is real
const { validateAuthorizationCode } = vi.hoisted(() => ({ validateAuthorizationCode: vi.fn() }));
vi.mock('arctic', async importOriginal => {
  const actual = await importOriginal<typeof import('arctic')>();
  class Google {
    constructor(private clientId: string, private clientSecret: string, private redirectURI: string) {}
    createAuthorizationURL(state: string, codeVerifier: string, scopes: string[]) {
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set('client_id', this.clientId);
      url.searchParams.set('redirect_uri', this.redirectURI);
      url.searchParams.set('state', state);
      url.searchParams.set('scope', scopes.join(' '));
      return url;
    }
    validateAuthorizationCode = validateAuthorizationCode;
  }
  return { ...actual, Google };
});

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
// An ID token as Google's token endpoint returns it (unsigned here: it's checked by where it came from)
const idToken = (claims: Record<string, unknown> = {}) => [
  base64url({ alg: 'RS256', typ: 'JWT' }),
  base64url({
    iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: 'google-123', email: 'Sam@Example.com', email_verified: true,
    name: 'Sam Smith', exp: Math.floor(Date.now() / 1000) + 3600, ...claims,
  }),
  'signature',
].join('.');

function useCloud() {
  vi.stubEnv('DEPLOYMENT_MODE', 'cloud');
  vi.stubEnv('APP_URL', 'https://app.example.test/');
  vi.stubEnv('GOOGLE_CLIENT_ID', CLIENT_ID);
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-secret');
}

beforeEach(() => {
  cookieJar.clear();
  validateAuthorizationCode.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('signing in with a password', () => {
  it('signs in with the right password', async () => {
    const email = `pat-${crypto.randomUUID()}@example.test`;
    await prisma.user.create({ data: { name: 'Pat', email, passwordHash: await bcrypt.hash('correct horse battery', 4) } });
    const form = new FormData();
    form.set('email', email);
    form.set('password', 'correct horse battery');
    await expect(login(form)).rejects.toThrow('REDIRECT:/');
    expect(cookieJar.get('session')).toBeTruthy();
  });

  it('counts wrong passwords tried all at once against the limit, before checking any', async () => {
    const email = `lee-${crypto.randomUUID()}@example.test`;
    await prisma.user.create({ data: { name: 'Lee', email, passwordHash: await bcrypt.hash('correct horse battery', 4) } });
    const attempt = (password: string) => {
      const form = new FormData();
      form.set('email', email);
      form.set('password', password);
      return login(form);
    };
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => attempt(`wrong guess ${i}`)));
    // Five per client (the tests have no address, so all are one client)
    expect(results.filter(r => r.error === 'Invalid email or password')).toHaveLength(5);
    expect(results.filter(r => r.error === 'Too many login attempts. Please try again later.')).toHaveLength(7);
    // Only the five checked count against the account
    expect((await prisma.rateLimit.findUniqueOrThrow({ where: { identifier: `login:${email}` } })).count).toBe(5);
  });

  it('gives a correct password\'s attempt back', async () => {
    const email = `kim-${crypto.randomUUID()}@example.test`;
    await prisma.user.create({ data: { name: 'Kim', email, passwordHash: await bcrypt.hash('correct horse battery', 4) } });
    const form = new FormData();
    form.set('email', email);
    form.set('password', 'wrong');
    await login(form);
    form.set('password', 'correct horse battery');
    await expect(login(form)).rejects.toThrow('REDIRECT:/');
    // The failure still counts against the account; the client's count is cleared
    expect((await prisma.rateLimit.findUniqueOrThrow({ where: { identifier: `login:${email}` } })).count).toBe(1);
    expect(await prisma.rateLimit.findFirst({ where: { identifier: { startsWith: `login:unknown:${email}` } } })).toBeNull();
  });

  it('never signs in to an account without a password, even with the dummy password it\'s timed against', async () => {
    const email = `sam-${crypto.randomUUID()}@example.test`;
    await prisma.user.create({ data: { name: 'Sam', email } });
    const form = new FormData();
    form.set('email', email);
    form.set('password', 'not-a-real-password');
    expect(await login(form)).toEqual({ error: 'Invalid email or password' });
    expect(cookieJar.get('session')).toBeUndefined();
  });

  it('is turned off on the hosted version', async () => {
    useCloud();
    const form = new FormData();
    form.set('email', 'anyone@example.test');
    form.set('password', 'whatever-it-is');
    expect(await login(form)).toEqual({ error: 'Sign in with Google' });
  });
});

describe('the hosted version\'s settings', () => {
  it('signs in with Google on the hosted version, and with a password otherwise', () => {
    expect(signInMethods()).toEqual(['password']);
    useCloud();
    expect(signInMethods()).toEqual(['google']);
  });

  it('won\'t start the hosted version without what it needs to sign people in', () => {
    expect(deploymentProblem()).toBeNull();
    vi.stubEnv('DEPLOYMENT_MODE', 'cloud');
    vi.stubEnv('APP_URL', '');
    vi.stubEnv('GOOGLE_CLIENT_ID', '');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
    expect(deploymentProblem()).toBe('DEPLOYMENT_MODE=cloud needs APP_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.');

    useCloud();
    expect(deploymentProblem()).toBeNull();
    vi.stubEnv('APP_URL', 'http://app.example.test');
    expect(deploymentProblem()).toBe('APP_URL must be an https address (or localhost, for development), not http://app.example.test.');
    vi.stubEnv('APP_URL', 'http://localhost:3000');
    expect(deploymentProblem()).toBeNull();
    vi.stubEnv('APP_URL', 'not an address');
    expect(deploymentProblem()).toBe('APP_URL isn\'t an address: not an address.');
  });
});

describe('reading Google\'s ID token', () => {
  beforeEach(useCloud);

  it('reads the account, with the email in lowercase', () => {
    expect(googleAccountFrom(idToken())).toEqual({ subject: 'google-123', email: 'sam@example.com', name: 'Sam Smith' });
    expect(googleAccountFrom(idToken({ name: undefined, given_name: undefined })).name).toBe('sam');
  });

  it('refuses a token that isn\'t from Google, for this app, current, or for a verified email', () => {
    const code = (claims: Record<string, unknown>) => {
      try {
        googleAccountFrom(idToken(claims));
      } catch (error) {
        return error instanceof GoogleSignInFailure ? error.code : 'not a sign-in failure';
      }
      return 'accepted';
    };
    expect(code({ iss: 'https://evil.example' })).toBe('failed');
    expect(code({ aud: 'someone-elses-app' })).toBe('failed');
    expect(code({ exp: Math.floor(Date.now() / 1000) - 60 })).toBe('failed');
    expect(code({ sub: '' })).toBe('failed');
    expect(code({ email_verified: false })).toBe('unverified');
    expect(code({ aud: ['other-app', CLIENT_ID] })).toBe('accepted');
  });
});

describe('the user a Google account signs in as', () => {
  it('is made on the first sign-in, with the default categories, and found by Google\'s id after that', async () => {
    const subject = `google-${crypto.randomUUID()}`;
    const email = `${subject}@example.test`;
    const first = await userForGoogleAccount({ subject, email, name: 'Sam' });
    expect(first).toMatchObject({ name: 'Sam', email, passwordHash: null, isAdmin: false });
    expect(await prisma.category.count({ where: { userId: first.id } })).toBeGreaterThan(0);

    // The email changed at Google: still the same account, found by its id
    const again = await userForGoogleAccount({ subject, email: `new-${email}`, name: 'Sam' });
    expect(again.id).toBe(first.id);
    expect((await prisma.identity.findFirstOrThrow({ where: { subject } })).email).toBe(`new-${email}`);
  });

  it('isn\'t linked to an existing account by matching email', async () => {
    const email = `taken-${crypto.randomUUID()}@example.test`;
    await prisma.user.create({ data: { name: 'Pat', email, passwordHash: 'x' } });
    await expect(userForGoogleAccount({ subject: `google-${crypto.randomUUID()}`, email, name: 'Pat' }))
      .rejects.toMatchObject({ code: 'email-taken' });
  });

  it('is only made or found for an allowed email, when ALLOWED_EMAILS is set', async () => {
    const subject = `google-${crypto.randomUUID()}`;
    const email = `${subject}@example.test`;
    // Its own case and spacing, against Google's email in lowercase
    vi.stubEnv('ALLOWED_EMAILS', ` someone@example.test , ${email.toUpperCase()} `);
    const user = await userForGoogleAccount({ subject, email, name: 'Sam' });

    const stranger = `google-${crypto.randomUUID()}`;
    await expect(userForGoogleAccount({ subject: stranger, email: `${stranger}@example.test`, name: 'Lee' }))
      .rejects.toMatchObject({ code: 'not-allowed' });
    expect(await prisma.user.findUnique({ where: { email: `${stranger}@example.test` } })).toBeNull();

    // Taken off the list: an existing account can't sign in either
    vi.stubEnv('ALLOWED_EMAILS', 'someone@example.test');
    await expect(userForGoogleAccount({ subject, email, name: 'Sam' })).rejects.toMatchObject({ code: 'not-allowed' });

    vi.stubEnv('ALLOWED_EMAILS', '');
    expect((await userForGoogleAccount({ subject, email, name: 'Sam' })).id).toBe(user.id);
  });
});

describe('the sign-in routes', () => {
  const start = (query = '') => startGoogle(new NextRequest(`https://app.example.test/api/auth/google${query}`));
  const callback = (query: string) => googleCallback(new NextRequest(`https://app.example.test/api/auth/google/callback${query}`));

  it('aren\'t there on a self-hosted server', async () => {
    expect((await start()).status).toBe(404);
    expect((await callback('?code=x&state=y')).status).toBe(404);
  });

  it('send the browser to Google, then sign in as the account it picked, going back where they were', async () => {
    useCloud();
    const subject = `google-${crypto.randomUUID()}`;
    const response = await start('?next=%2Flog%2Fabc');
    expect(response.status).toBe(307);
    const google = new URL(response.headers.get('location')!);
    expect(google.origin).toBe('https://accounts.google.com');
    expect(google.searchParams.get('redirect_uri')).toBe('https://app.example.test/api/auth/google/callback');
    expect(google.searchParams.get('scope')).toBe('openid email profile');
    expect(google.searchParams.get('prompt')).toBe('select_account');
    const state = google.searchParams.get('state')!;
    expect(cookieJar.get('google_oauth_state')).toBe(state);

    validateAuthorizationCode.mockResolvedValue({ idToken: () => idToken({ sub: subject, email: `${subject}@example.test` }) });
    const back = await callback(`?code=the-code&state=${state}`);
    expect(back.headers.get('location')).toBe('https://app.example.test/log/abc');
    expect(validateAuthorizationCode).toHaveBeenCalledWith('the-code', cookieJar.get('google_code_verifier') || expect.any(String));
    const session = await prisma.session.findUniqueOrThrow({ where: { id: cookieJar.get('session')! }, include: { user: true } });
    expect(session.user.email).toBe(`${subject}@example.test`);
    // Each sign-in's cookies are good for one callback
    expect(cookieJar.get('google_oauth_state')).toBe('');
  });

  it('turn away a callback this browser didn\'t start, or one used twice', async () => {
    useCloud();
    expect((await callback('?code=the-code&state=made-up')).headers.get('location')).toBe('https://app.example.test/login?error=expired');

    const google = new URL((await start()).headers.get('location')!);
    const state = google.searchParams.get('state')!;
    validateAuthorizationCode.mockResolvedValue({ idToken: () => idToken({ sub: `google-${crypto.randomUUID()}`, email: `${crypto.randomUUID()}@example.test` }) });
    expect((await callback(`?code=the-code&state=${state}`)).headers.get('location')).toBe('https://app.example.test/');
    expect((await callback(`?code=the-code&state=${state}`)).headers.get('location')).toBe('https://app.example.test/login?error=expired');
    expect(validateAuthorizationCode).toHaveBeenCalledTimes(1);
  });

  it('say why when Google is backed out of or turns them away', async () => {
    useCloud();
    await start('?next=%2Fsettings');
    expect((await callback('?error=access_denied')).headers.get('location')).toBe('https://app.example.test/login?error=cancelled&next=%2Fsettings');

    const state = new URL((await start()).headers.get('location')!).searchParams.get('state')!;
    validateAuthorizationCode.mockRejectedValue(new Error('invalid_grant'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await callback(`?code=bad&state=${state}`)).headers.get('location')).toBe('https://app.example.test/login?error=failed');
    expect(cookieJar.get('session')).toBeUndefined();
  });

  it('turn away a Google account that isn\'t in ALLOWED_EMAILS, without signing in', async () => {
    useCloud();
    vi.stubEnv('ALLOWED_EMAILS', 'invited@example.test');
    const state = new URL((await start('?next=%2Fsettings')).headers.get('location')!).searchParams.get('state')!;
    validateAuthorizationCode.mockResolvedValue({ idToken: () => idToken({ sub: `google-${crypto.randomUUID()}`, email: 'uninvited@example.test' }) });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await callback(`?code=the-code&state=${state}`)).headers.get('location')).toBe('https://app.example.test/login?error=not-allowed&next=%2Fsettings');
    expect(cookieJar.get('session')).toBeUndefined();
  });
});
