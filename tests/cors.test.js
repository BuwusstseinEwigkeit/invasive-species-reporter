function loadCors(nodeEnv, allowedOrigins) {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAllowedOrigins = process.env.ALLOWED_ORIGINS;

  process.env.NODE_ENV = nodeEnv;
  process.env.ALLOWED_ORIGINS = allowedOrigins;
  jest.resetModules();
  const middleware = require("../server/middleware/cors");

  return {
    middleware,
    restore() {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousAllowedOrigins === undefined) delete process.env.ALLOWED_ORIGINS;
      else process.env.ALLOWED_ORIGINS = previousAllowedOrigins;
      jest.resetModules();
    }
  };
}

function makeResponse() {
  const headers = {};
  return {
    headers,
    statusCode: null,
    body: null,
    header(name, value) {
      headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    }
  };
}

describe("production CORS boundary", () => {
  test("native clients without Origin are not blocked", () => {
    const loaded = loadCors("production", "https://console.example");
    try {
      const req = { method: "GET", headers: {} };
      const res = makeResponse();
      let nextCalled = false;

      loaded.middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(res.statusCode).toBeNull();
      expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
    } finally {
      loaded.restore();
    }
  });

  test("browser origins outside the production allowlist are rejected", () => {
    const loaded = loadCors("production", "https://console.example");
    try {
      const req = { method: "GET", headers: { origin: "https://evil.example" } };
      const res = makeResponse();
      let nextCalled = false;

      loaded.middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe(403);
    } finally {
      loaded.restore();
    }
  });

  test("allowed browser origins receive PATCH-capable preflight headers", () => {
    const loaded = loadCors("production", "https://console.example");
    try {
      const req = { method: "OPTIONS", headers: { origin: "https://console.example" } };
      const res = makeResponse();

      loaded.middleware(req, res, () => {
        throw new Error("OPTIONS should end before next()");
      });

      expect(res.statusCode).toBe(204);
      expect(res.headers["Access-Control-Allow-Origin"]).toBe("https://console.example");
      expect(res.headers["Access-Control-Allow-Methods"]).toContain("PATCH");
    } finally {
      loaded.restore();
    }
  });
});
