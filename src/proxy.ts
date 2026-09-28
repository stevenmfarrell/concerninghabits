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
  // Everything except API routes, Next internals, and requests for a static file (an extension at
  // the end of the path) - a narrower exemption than checking whether the path contains a dot
  // anywhere, which could accidentally skip auth on a route with a literal "." in a segment.
  matcher: ['/((?!api|_next/static|_next/image|.*\\.\\w+$).*)'],
};
