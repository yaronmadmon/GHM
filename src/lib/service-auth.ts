import { timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

export function verifyMoraServiceKey(request: NextRequest): boolean {
  const provided = request.headers.get('x-mora-key');
  const expected = process.env.MORA_SERVICE_API_KEY;
  if (!provided || !expected) return false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function moraServiceGuard(request: NextRequest): Response | null {
  if (!verifyMoraServiceKey(request)) {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    console.warn(`[mora-service] REJECTED ${request.method} ${request.nextUrl.pathname} from ${ip}`);
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  console.log(`[mora-service] ${request.method} ${request.nextUrl.pathname}`);
  return null;
}
