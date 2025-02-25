import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { neon } from '@neondatabase/serverless';
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Initialize Express app
const app = express();

// Setup middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://syllogic.app', 'https://www.syllogic.app'] 
    : 'http://localhost:5000',
  credentials: true
}));

// Session configuration
const PgSession = connectPgSimple(session);

// Setup database connection for session store
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/syllogic';

const sessionConfig = {
  store: new PgSession({
    conString: DATABASE_URL,
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'syllogism-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    // In development, don't require HTTPS
    secure: false,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax',
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
  console.log(`Database URL set: ${process.env.DATABASE_URL ? 'Yes' : 'No'}`);
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
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, "0.0.0.0", () => {
    log(`Server running on port ${PORT} in ${app.get('env')} mode`);
  });
})();