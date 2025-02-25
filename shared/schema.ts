import { pgTable, text, serial, integer, jsonb, varchar, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
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
  subject: z.string().min(1, "Subject is required").max(100, "Subject is too long"),
  predicate: z.string().min(1, "Predicate is required").max(100, "Predicate is too long"),
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
  name: z.string().max(100).optional(),
  premises: z.array(premiseSchema).min(2, "At least 2 premises are required").max(50, "Maximum 50 premises allowed"),
  conclusion: premiseSchema.optional(),
});

export const proofSchema = z.object({
  steps: z.array(proofStepSchema),
  isValid: z.boolean(),
  explanation: z.string().optional(),
});

// User schema for authentication
export const userSchema = z.object({
  id: z.number().optional(),
  username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username must be at most 50 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Database tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull(),
  email: varchar("email", { length: 100 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    emailIndex: uniqueIndex("email_idx").on(table.email),
  };
});

export const syllogisms = pgTable("syllogisms", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }),
  premises: jsonb("premises").$type<z.infer<typeof premiseSchema>[]>().notNull(),
  conclusion: jsonb("conclusion").$type<z.infer<typeof premiseSchema>>().notNull(),
  proof: jsonb("proof").$type<z.infer<typeof proofSchema>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSyllogismSchema = createInsertSchema(syllogisms);
export const insertUserSchema = createInsertSchema(users);

export type Premise = z.infer<typeof premiseSchema>;
export type ProofStep = z.infer<typeof proofStepSchema>;
export type Argument = z.infer<typeof argumentSchema>;
export type Proof = z.infer<typeof proofSchema>;
export type User = z.infer<typeof userSchema>;
export type Login = z.infer<typeof loginSchema>;
export type InsertSyllogism = z.infer<typeof insertSyllogismSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type SyllogismRecord = typeof syllogisms.$inferSelect;
export type UserRecord = typeof users.$inferSelect;