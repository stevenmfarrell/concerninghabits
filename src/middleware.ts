import { NextRequest, NextResponse } from 'next/server';

const publicRoutes = ['/login', '/setup'];

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(path);

  // Allow static files, api routes, and next internals
  if (
    path.startsWith('/_next') || 
    path.startsWith('/api') || 
    path.includes('.')
  ) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get('session');

  if (!sessionCookie && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }

  if (sessionCookie && isPublicRoute) {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  return NextResponse.next();
}
