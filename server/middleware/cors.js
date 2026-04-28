const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (isProduction && allowedOrigins.length === 0) {
  console.warn(
    "[CORS] WARNING: Running in production without specific ALLOWED_ORIGINS. CORS is fully restrictive."
  );
}

function corsMiddleware(req, res, next) {
  if (isProduction && allowedOrigins.length > 0 && !allowedOrigins.includes("*")) {
    const origin = req.headers.origin;
    if (!allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", "null");
      res.status(403).json({ success: false, error: "CORS not allowed.", code: 403 });
      return;
    }
    res.header("Access-Control-Allow-Origin", origin);
  } else if (allowedOrigins.includes("*")) {
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  } else {
    res.header("Access-Control-Allow-Origin", "null");
  }

  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
}

module.exports = corsMiddleware;
