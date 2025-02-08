import { pgTable, text, serial, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define the premise type and form
export const PremiseForm = {
  A: "A", // Universal Affirmative
  E: "E", // Universal Negative
  I: "I", // Particular Affirmative
  O: "O", // Particular Negative
} as const;

export type PremiseForm = typeof PremiseForm[keyof typeof PremiseForm];

export const premiseSchema = z.object({
  form: z.enum([PremiseForm.A, PremiseForm.E, PremiseForm.I, PremiseForm.O]),
  subject: z.string(),
  predicate: z.string(),
});

export const transformationSchema = z.object({
  type: z.enum(["original", "obverse", "contrapositive", "converse"]),
  premise: premiseSchema
});

export const proofStepSchema = z.object({
  number: z.number(),
  premise: premiseSchema,
  rule: z.string(),
  fromSteps: z.array(z.number()).optional(),
  transformation: transformationSchema.optional(),
  intermediateSteps: z.array(transformationSchema).optional()
});

export const argumentSchema = z.object({
  premises: z.array(premiseSchema).min(2).max(50),
  conclusion: premiseSchema.optional(),
});

export const proofSchema = z.object({
  steps: z.array(proofStepSchema),
  isValid: z.boolean(),
  explanation: z.string().optional(),
});

// Database tables
export const syllogisms = pgTable("syllogisms", {
  id: serial("id").primaryKey(),
  premises: jsonb("premises").$type<z.infer<typeof premiseSchema>[]>(),
  conclusion: jsonb("conclusion").$type<z.infer<typeof premiseSchema>>().notNull(),
  proof: jsonb("proof").$type<z.infer<typeof proofSchema>>(),
});

export const insertSyllogismSchema = createInsertSchema(syllogisms);

export type Premise = z.infer<typeof premiseSchema>;
export type ProofStep = z.infer<typeof proofStepSchema>;
export type Argument = z.infer<typeof argumentSchema>;
export type Proof = z.infer<typeof proofSchema>;
export type InsertSyllogism = z.infer<typeof insertSyllogismSchema>;
export type SyllogismRecord = typeof syllogisms.$inferSelect;