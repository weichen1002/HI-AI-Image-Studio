function bucketKey(req) {
  const ip = String(req.ip || '').trim();
  return ip || 'unknown';
}

export function createRateLimiter({ windowSeconds, max, maxBuckets }) {
  const buckets = new Map();
  const windowMs = Math.max(1, Number(windowSeconds || 60)) * 1000;
  const limit = Math.max(1, Number(max || 20));
  const bucketLimit = Math.max(limit, Number(maxBuckets || 5000));
  let lastPrunedAt = 0;

  function pruneExpired(now) {
    if (now - lastPrunedAt < windowMs) return;
    lastPrunedAt = now;
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  return function rateLimit(req, res, next) {
    const now = Date.now();
    pruneExpired(now);

    const key = bucketKey(req);
    const existing = buckets.get(key);
    if (!existing && buckets.size >= bucketLimit) {
      for (const [bucketKeyValue, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) buckets.delete(bucketKeyValue);
      }
      if (buckets.size >= bucketLimit) {
        return res.status(429).json({ error: 'rate_limited' });
      }
    }

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
