import { describe, expect, it } from 'vitest';
import { isSecureCookie } from '@/lib/auth';

describe('isSecureCookie', () => {
  it('follows the request protocol', () => {
    expect(isSecureCookie(undefined, 'https')).toBe(true);
    expect(isSecureCookie(undefined, 'http')).toBe(false);
    expect(isSecureCookie(undefined, null)).toBe(false);
  });

  it('uses the client side of a chain of proxies', () => {
    expect(isSecureCookie(undefined, 'https, http')).toBe(true);
    expect(isSecureCookie(undefined, 'http, https')).toBe(false);
    expect(isSecureCookie(undefined, ' HTTPS ')).toBe(true);
  });

  it('can be overridden with COOKIE_SECURE', () => {
    expect(isSecureCookie('true', 'http')).toBe(true);
    expect(isSecureCookie('TRUE', null)).toBe(true);
    expect(isSecureCookie('false', 'https')).toBe(false);
  });

  it('ignores an unrecognized COOKIE_SECURE', () => {
    expect(isSecureCookie('yes', 'http')).toBe(false);
    expect(isSecureCookie('', 'https')).toBe(true);
  });
});
