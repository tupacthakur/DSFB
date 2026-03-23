import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/server/api/errors';

const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Cache-Control': 'no-store',
} as const;

export function ok<T>(body: T, status = 200): NextResponse<T> {
  return NextResponse.json(body, {
    status,
    headers: BASE_HEADERS,
  });
}

export function fail(err: ApiError): NextResponse {
  return NextResponse.json(
    {
      error: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    },
    {
      status: err.status,
      headers: BASE_HEADERS,
    }
  );
}
