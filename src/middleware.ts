import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from './lib/auth';

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

  const session = await verifySession();

  if (!session?.userId && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }

  if (session?.userId && isPublicRoute) {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  return NextResponse.next();
}
