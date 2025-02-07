import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { argumentSchema, proofSchema } from "@shared/schema";
import { evaluateSyllogism } from "@/lib/syllogism";

export function registerRoutes(app: Express) {
  app.post("/api/evaluate", async (req, res) => {
    try {
      const argument = argumentSchema.parse(req.body);
      const proof = evaluateSyllogism(argument);
      if (argument.conclusion) {
        await storage.saveArgument(argument, proof);
      }
      res.json(proof);
    } catch (error) {
      res.status(400).json({ error: "Invalid argument format" });
    }
  });

  app.get("/api/arguments", async (_req, res) => {
    const syllogisms = await storage.listArguments();
    res.json(syllogisms);
  });

  app.get("/api/arguments/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const syllogism = await storage.getArgument(id);
    if (!syllogism) {
      res.status(404).json({ error: "Argument not found" });
      return;
    }
    res.json(syllogism);
  });

  return createServer(app);
}