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
  const origin = req.headers.origin;
  if (isProduction && allowedOrigins.length > 0 && !allowedOrigins.includes("*")) {
    // CORS is a browser boundary. Native/mini-program/server-to-server clients may
    // legitimately omit Origin and should not be rejected for that reason.
    if (origin && !allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", "null");
      res.status(403).json({ success: false, error: "CORS not allowed.", code: 403 });
      return;
    }
    if (origin) res.header("Access-Control-Allow-Origin", origin);
  } else if (allowedOrigins.includes("*")) {
    res.header("Access-Control-Allow-Origin", origin || "*");
  } else if (origin) {
    res.header("Access-Control-Allow-Origin", "null");
  }

  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
}

module.exports = corsMiddleware;
