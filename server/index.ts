import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import { randomBytes } from "crypto";
import { pool } from "./db";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const isProduction = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT) || 5000;

// Session secret: required in production; a random per-process secret in development
// (dev sessions are invalidated whenever the server restarts).
function resolveSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (isProduction) {
    throw new Error("SESSION_SECRET must be set when NODE_ENV=production");
  }
  console.warn("SESSION_SECRET is not set; using a random per-process secret for development.");
  return randomBytes(32).toString("hex");
}

// Initialize Express app
const app = express();

// Behind an HTTPS-terminating proxy in production, trust it so secure cookies are issued.
if (isProduction) {
  app.set("trust proxy", 1);
}

// Setup middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// The client is served from the same origin as the API, so production allows no
// cross-origin callers; development allows the local dev server origin only.
app.use(cors({
  origin: isProduction ? false : `http://localhost:${PORT}`,
  credentials: true
}));

// Session configuration (sessions are stored in PostgreSQL)
const PgSession = connectPgSimple(session);

const sessionConfig: session.SessionOptions = {
  store: new PgSession({
    pool,
    createTableIfMissing: true,
  }),
  secret: resolveSessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    // HTTPS-only cookies in production; plain HTTP allowed for local development
    secure: isProduction,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: "lax",
  }
};

app.use(session(sessionConfig));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Capture API responses for logging
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      // Don't log full response body for security and clarity
      if (capturedJsonResponse) {
        // Sanitize sensitive data from logs
        const sanitized = { ...capturedJsonResponse };
        if (sanitized.user?.email) sanitized.user.email = '***@***.***';
        if (sanitized.passwordHash) delete sanitized.passwordHash;

        // Truncate long response bodies
        const jsonStr = JSON.stringify(sanitized);
        logLine += jsonStr.length > 50 ? ` :: ${jsonStr.slice(0, 50)}...` : ` :: ${jsonStr}`;
      }

      if (logLine.length > 120) {
        logLine = logLine.slice(0, 119) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Initialize the application
(async () => {
  // Log environment details for debugging
  console.log(`Node environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Using PostgreSQL database for sessions and data storage`);
  
  // Register routes and create HTTP server
  const server = registerRoutes(app);

  // Global error handler middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Server error:', err);

    // Don't expose internal errors to clients
    const status = err.status || err.statusCode || 500;
    const message = status === 500 
      ? 'Internal Server Error' 
      : err.message || 'Something went wrong';

    // Send appropriate error response
    if (!res.headersSent) {
      res.status(status).json({ error: message });
    }
  });

  // Set up static file serving or development server
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Start the server
  server.listen(PORT, "0.0.0.0", () => {
    log(`Server running on port ${PORT} in ${app.get('env')} mode`);
  });
})();