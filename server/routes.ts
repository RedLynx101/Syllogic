import type { Express, Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { argumentSchema, userSchema, loginSchema } from "@shared/schema";
import { evaluateSyllogism } from "@/lib/syllogism";
import { ZodError } from "zod";

// Auth middleware
const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.session?.userId;
  
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  try {
    const user = await storage.getUserById(userId);
    
    if (!user) {
      req.session.destroy((err) => {
        if (err) console.error('Error destroying session:', err);
      });
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    // Attach user to request
    (req as any).user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Error handler
const handleErrors = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', err);
  
  if (err instanceof ZodError) {
    return res.status(400).json({ 
      error: "Validation error", 
      details: err.errors 
    });
  }
  
  res.status(500).json({ error: err.message || "Internal server error" });
};

export function registerRoutes(app: Express) {
  // Auth routes
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      console.log('Registration request received');
      const userData = userSchema.parse(req.body);
      console.log('User data validated');
      
      const user = await storage.createUser(userData);
      console.log('User created with ID:', user.id);
      
      // Auto login after registration
      req.session.userId = user.id;
      
      // Save session promise
      const saveSession = new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error('Error saving session:', err);
            reject(err);
          } else {
            console.log('Session saved successfully. userId:', user.id);
            resolve();
          }
        });
      });
      
      // Wait for session to be saved
      await saveSession;
      
      res.status(201).json({ 
        message: "User registered successfully",
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      next(error);
    }
  });
  
  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await storage.validateUser(email, password);
      
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Set user ID in session
      req.session.userId = user.id;
      
      // Save session promise
      const saveSession = new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error('Error saving session:', err);
            reject(err);
          } else {
            console.log('Session saved successfully for login. userId:', user.id);
            resolve();
          }
        });
      });
      
      // Wait for session to be saved
      await saveSession;
      
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
  
  app.get("/api/auth/me", authenticateUser, async (req, res) => {
    const user = (req as any).user;
    res.json({ user });
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
  
  // Syllogism routes
  app.post("/api/evaluate", async (req, res, next) => {
    try {
      const argument = argumentSchema.parse(req.body);
      const proof = evaluateSyllogism(argument);
      
      // Only save if there's a conclusion
      if (argument.conclusion) {
        // Get user ID from session if available
        const userId = req.session?.userId;
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

  // Public arguments (for exploration)
  app.get("/api/arguments", async (_req, res, next) => {
    try {
      const syllogisms = await storage.listArguments();
      res.json(syllogisms);
    } catch (error) {
      next(error);
    }
  });

  // Get specific argument
  app.get("/api/arguments/:id", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }
      
      const syllogism = await storage.getArgument(id);
      if (!syllogism) {
        return res.status(404).json({ error: "Argument not found" });
      }
      
      res.json(syllogism);
    } catch (error) {
      next(error);
    }
  });
  
  // User's arguments
  app.get("/api/user/arguments", authenticateUser, async (req, res, next) => {
    try {
      const userId = (req as any).user.id;
      const userArguments = await storage.listArguments(userId);
      res.json(userArguments);
    } catch (error) {
      next(error);
    }
  });
  
  // Update argument
  app.put("/api/arguments/:id", authenticateUser, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }
      
      // Get existing argument
      const existingArgument = await storage.getArgument(id);
      if (!existingArgument) {
        return res.status(404).json({ error: "Argument not found" });
      }
      
      // Check ownership
      const userId = (req as any).user.id;
      if (existingArgument.userId && existingArgument.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to update this argument" });
      }
      
      // Update with new data
      const argument = argumentSchema.parse(req.body);
      const proof = evaluateSyllogism(argument);
      
      const updatedArgument = await storage.updateArgument(id, argument, proof);
      res.json(updatedArgument);
    } catch (error) {
      next(error);
    }
  });
  
  // Delete argument
  app.delete("/api/arguments/:id", authenticateUser, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID format" });
      }
      
      // Get existing argument
      const existingArgument = await storage.getArgument(id);
      if (!existingArgument) {
        return res.status(404).json({ error: "Argument not found" });
      }
      
      // Check ownership
      const userId = (req as any).user.id;
      if (existingArgument.userId && existingArgument.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to delete this argument" });
      }
      
      const success = await storage.deleteArgument(id);
      if (success) {
        res.json({ message: "Argument deleted successfully" });
      } else {
        res.status(500).json({ error: "Failed to delete argument" });
      }
    } catch (error) {
      next(error);
    }
  });

  // Register error handler
  app.use(handleErrors);

  return createServer(app);
}