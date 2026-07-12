import { NextRequest } from 'next/server';

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export function createRateLimiter(windowMs: number, maxRequests: number) {
  const store = new Map<string, { count: number; resetAt: number }>();

  return function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const record = store.get(ip);
    if (!record || now > record.resetAt) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
      return false;
    }
    record.count++;
    return record.count > maxRequests;
  };
}

export function isValidAnthropicKey(key: unknown): key is string {
  return typeof key === 'string' && key.startsWith('sk-ant-api') && key.length >= 40 && key.length <= 120;
}

export function sanitizeForLog(value: string): string {
  return value.replace(/[\r\n]/g, ' ').slice(0, 200);
}
