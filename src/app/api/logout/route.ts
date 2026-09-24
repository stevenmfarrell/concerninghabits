import { deleteSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  await deleteSession();
  return NextResponse.redirect(new URL('/login', request.url));
}
