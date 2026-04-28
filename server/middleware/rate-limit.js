const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000;
const rateLimitMaxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 500;
const rateLimitStore = new Map();

function rateLimiter(req, res, next) {
  if (req.path === "/health") {
    next();
    return;
  }

  const clientIp = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
  const key = `rate:${clientIp}`;
  const now = Date.now();

  let record = rateLimitStore.get(key);
  if (!record || now - record.windowStart > rateLimitWindowMs) {
    record = { windowStart: now, count: 0 };
  }

  record.count += 1;
  rateLimitStore.set(key, record);

  res.setHeader("X-RateLimit-Limit", rateLimitMaxRequests);
  res.setHeader("X-RateLimit-Remaining", Math.max(0, rateLimitMaxRequests - record.count));
  res.setHeader("X-RateLimit-Reset", Math.ceil((record.windowStart + rateLimitWindowMs) / 1000));

  if (record.count > rateLimitMaxRequests) {
    res.status(429).json({
      success: false,
      error: "Too many requests. Please try again later.",
      code: 429,
      retryAfter: Math.ceil((record.windowStart + rateLimitWindowMs - now) / 1000),
    });
    return;
  }

  next();
}

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now - record.windowStart > rateLimitWindowMs * 2) {
      rateLimitStore.delete(key);
    }
  }
}, rateLimitWindowMs);

module.exports = { rateLimiter, rateLimitStore };
