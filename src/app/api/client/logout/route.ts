import { NextResponse } from 'next/server';
import { CLIENT_TOKEN_COOKIE } from '@/lib/security/constants';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(CLIENT_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
  return response;
}
