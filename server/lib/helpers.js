function sendError(res, error, code = 400) {
  res.status(code).json({ success: false, error, code });
}

function sendSuccess(res, data, statusCode = 200) {
  res.status(statusCode).json(data);
}

function getPublicBaseUrl(req) {
  return process.env.SERVER_PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
}

module.exports = { sendError, sendSuccess, getPublicBaseUrl };
