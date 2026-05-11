import type { NextFunction, Request, Response } from 'express';
import { logHttpRequest } from './logger';

function resolveIp(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || '';
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0]?.trim() || '';
  }
  return req.ip || req.socket?.remoteAddress || '';
}

export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const startedAt = Date.now();

  res.on('finish', () => {
    const userId = String((req as any)?.user?.id || '').trim();
    logHttpRequest({
      method: req.method,
      path: req.originalUrl || req.url || '/',
      statusCode: Number(res.statusCode || 200),
      durationMs: Date.now() - startedAt,
      userId,
      ip: resolveIp(req),
    });
  });

  next();
}
