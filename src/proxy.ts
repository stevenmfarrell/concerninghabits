import { NextRequest, NextResponse } from 'next/server';
import { RETURN_TO_HEADER, RETURN_TO_PARAM, safeReturnTo, withReturnTo } from '@/lib/returnTo';
import { LEGACY_VIEW_COOKIE } from '@/lib/viewPrefs';

const publicRoutes = ['/login', '/setup'];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(path);

  const sessionCookie = req.cookies.get('session');
  const requestedPath = path + req.nextUrl.search;

  if (!sessionCookie && !isPublicRoute) {
    return NextResponse.redirect(new URL(withReturnTo('/login', requestedPath), req.nextUrl));
  }

  if (sessionCookie && isPublicRoute) {
    const returnTo = safeReturnTo(req.nextUrl.searchParams.get(RETURN_TO_PARAM));
    return NextResponse.redirect(new URL(returnTo ?? '/', req.nextUrl));
  }

  const headers = new Headers(req.headers);
  headers.set(RETURN_TO_HEADER, requestedPath);
  const response = NextResponse.next({ request: { headers } });
  // Pages' views used to be remembered in a cookie per habit and chart, which the browser would
  // keep sending for years; they're one cookie now (see viewPrefs), so the old ones are cleared
  for (const { name } of req.cookies.getAll()) {
    if (LEGACY_VIEW_COOKIE.test(name)) response.cookies.delete(name);
  }
  return response;
}

export const config = {
  // Everything except API routes, Next internals, requests for a static file (an extension at
  // the end of the path), and the generated app icons (src/app/icon*.tsx, apple-icon.tsx). The
  // static-file check is narrower than checking whether the path contains a dot anywhere, which
  // could accidentally skip auth on a route with a literal "." in a segment. The icons have no
  // extension but must stay public: browsers fetch the PWA manifest's icons without cookies, and
  // an icon that redirects to /login makes the app uninstallable.
  matcher: ['/((?!api|_next/static|_next/image|(?:apple-)?icon\\d*$|.*\\.\\w+$).*)'],
};
