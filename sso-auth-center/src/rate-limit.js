function bucketKey(req) {
  const ip = String(req.ip || '').trim();
  return ip || 'unknown';
}

export function createRateLimiter({ windowSeconds, max }) {
  const buckets = new Map();
  const windowMs = Math.max(1, Number(windowSeconds || 60)) * 1000;
  const limit = Math.max(1, Number(max || 20));

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = bucketKey(req);
    const existing = buckets.get(key);
    const bucket =
      existing && existing.resetAt > now
        ? existing
        : { count: 0, resetAt: now + windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > limit) {
      return res.status(429).json({ error: 'rate_limited' });
    }

    return next();
  };
}
