import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const PROTECTED = ['/dashboard'];

// Routes only for unauthenticated users
const AUTH_ONLY = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Read auth token from cookie (set after login)
  const token = request.cookies.get('veritas-access-token')?.value;

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isAuthOnly = AUTH_ONLY.some((p) => pathname.startsWith(p));

  // Not logged in → trying to access dashboard → redirect to login
  if (isProtected && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Already logged in → trying to access login → redirect to dashboard
  if (isAuthOnly && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static
     * - _next/image
     * - favicon.ico
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)',
  ],
};
