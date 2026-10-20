import type { Express, Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { storage, type SafeUser } from "./storage";
import { EmailInUseError } from "./errors";
import { argumentSchema, userSchema, loginSchema, type SyllogismRecord } from "@shared/schema";
import { evaluateSyllogism } from "@/lib/syllogism";
import { ZodError } from "zod";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

type AuthedRequest = Request & { user: SafeUser };

// PostgreSQL `serial` ids are 32-bit; anything outside 1..2^31-1 cannot exist.
const MAX_ID = 2_147_483_647;

/** Parses a positive integer route id ("12"), or returns null for anything else ("12abc", "1.5", "0"). */
function parseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return id >= 1 && id <= MAX_ID ? id : null;
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

/** Requires a signed-in session whose user still exists; responds 401 otherwise. */
const requireUser = async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Sign in to continue" });
  }

  try {
    const user = await storage.getUserById(userId);

    if (!user) {
      req.session.destroy((err) => {
        if (err) console.error('Error destroying session:', err);
      });
      return res.status(401).json({ error: "Sign in to continue" });
    }

    (req as AuthedRequest).user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Loads an argument for its owner. Storage already scopes the query to the owner; the
 * second check keeps the route safe even if a storage implementation does not.
 */
async function findOwnedArgument(id: number, userId: number): Promise<SyllogismRecord | undefined> {
  const record = await storage.getArgument(id, userId);
  return record && record.userId === userId ? record : undefined;
}

// Someone else's argument and a missing argument get the same answer, so ids cannot be probed.
const notFound = (res: Response) => res.status(404).json({ error: "Argument not found" });

// Error handler: validation and malformed-request errors are 400; anything else is a
// generic 500 so internal details (SQL, stack traces) never reach the client.
const handleErrors = (err: any, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation error",
      details: err.errors
    });
  }

  if (err instanceof EmailInUseError) {
    return res.status(409).json({ error: err.message });
  }

  const status = Number(err?.status || err?.statusCode);
  if (status >= 400 && status < 500) {
    return res.status(status).json({ error: err.expose && err.message ? err.message : "Bad request" });
  }

  console.error('API Error:', err);
  res.status(500).json({ error: "Internal server error" });
};

export function registerRoutes(app: Express) {
  // Auth routes
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const userData = userSchema.parse(req.body);
      const user = await storage.createUser(userData);

      // Sign the new user in straight away
      req.session.userId = user.id;
      await saveSession(req);

      res.status(201).json({
        message: "User registered successfully",
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await storage.validateUser(email, password);

      if (!user) {
        return res.status(401).json({ error: "Email or password is incorrect" });
      }

      req.session.userId = user.id;
      await saveSession(req);

      res.json({
        message: "Login successful",
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/auth/me", requireUser, async (req, res) => {
    res.json({ user: (req as AuthedRequest).user });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).json({ error: "Logout failed" });
      }

      res.json({ message: "Logged out successfully" });
    });
  });

  // Evaluating is open to everyone and never persists anything. Saving is an explicit
  // request (`save: true`) from a signed-in user and requires a conclusion.
  app.post("/api/evaluate", async (req, res, next) => {
    try {
      const argument = argumentSchema.parse(req.body);
      const proof = evaluateSyllogism(argument);

      if (req.body?.save === true) {
        const userId = req.session?.userId;
        if (!userId || !(await storage.getUserById(userId))) {
          return res.status(401).json({ error: "Sign in to save arguments" });
        }
        if (!argument.conclusion) {
          return res.status(400).json({ error: "A conclusion is required to save an argument" });
        }
        const savedArgument = await storage.saveArgument(argument, proof, userId);
        return res.json({
          proof,
          savedArgument
        });
      }

      res.json({ proof });
    } catch (error) {
      next(error);
    }
  });

  // Saved arguments are private: every route below requires a session and only ever
  // returns, changes or deletes the caller's own arguments.
  const listOwnArguments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await storage.listArguments((req as AuthedRequest).user.id));
    } catch (error) {
      next(error);
    }
  };

  app.get("/api/arguments", requireUser, listOwnArguments);
  app.get("/api/user/arguments", requireUser, listOwnArguments);

  app.get("/api/arguments/:id", requireUser, async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const argument = await findOwnedArgument(id, (req as AuthedRequest).user.id);
      if (!argument) return notFound(res);

      res.json(argument);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/arguments/:id", requireUser, async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const userId = (req as AuthedRequest).user.id;
      if (!(await findOwnedArgument(id, userId))) return notFound(res);

      const argument = argumentSchema.parse(req.body);
      if (!argument.conclusion) {
        return res.status(400).json({ error: "A conclusion is required to save an argument" });
      }
      const proof = evaluateSyllogism(argument);

      const updatedArgument = await storage.updateArgument(id, userId, argument, proof);
      if (!updatedArgument) return notFound(res);

      res.json(updatedArgument);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/arguments/:id", requireUser, async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: "Invalid ID format" });
      }

      const userId = (req as AuthedRequest).user.id;
      if (!(await findOwnedArgument(id, userId))) return notFound(res);

      const deleted = await storage.deleteArgument(id, userId);
      if (!deleted) return notFound(res);

      res.json({ message: "Argument deleted successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Register error handler
  app.use(handleErrors);

  return createServer(app);
}
