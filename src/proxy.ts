import { NextRequest, NextResponse } from 'next/server';

const publicRoutes = ['/login', '/setup'];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(path);

  const sessionCookie = req.cookies.get('session');

  if (!sessionCookie && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }

  if (sessionCookie && isPublicRoute) {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  return NextResponse.next();
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
