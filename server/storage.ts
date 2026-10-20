import {
  type Argument,
  type Proof,
  type SyllogismRecord,
  type User,
  type UserRecord,
  syllogisms,
  users
} from "@shared/schema";
import { and, desc, eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { EmailInUseError } from './errors';

// Re-export the shared Drizzle client (DATABASE_URL is required; see server/db.ts)
export { db };

export type SafeUser = Omit<UserRecord, 'passwordHash'>;

/**
 * Persistence for users and saved arguments.
 *
 * Every argument read or write after creation is scoped to an owner: callers pass the
 * signed-in user's id, and an argument that belongs to someone else (or to nobody) is
 * treated as missing.
 */
export interface IStorage {
  saveArgument(argument: Argument, proof: Proof, userId: number): Promise<SyllogismRecord>;
  /** The argument with this id, only if `userId` owns it. */
  getArgument(id: number, userId: number): Promise<SyllogismRecord | undefined>;
  /** All arguments owned by `userId`, most recently updated first. */
  listArguments(userId: number): Promise<SyllogismRecord[]>;
  /** Updates the argument only if `userId` owns it; `undefined` otherwise. */
  updateArgument(id: number, userId: number, argument: Argument, proof: Proof): Promise<SyllogismRecord | undefined>;
  /** Deletes the argument only if `userId` owns it; `false` when nothing was deleted. */
  deleteArgument(id: number, userId: number): Promise<boolean>;
  createUser(user: Omit<User, 'id'>): Promise<SafeUser>;
  getUserByEmail(email: string): Promise<UserRecord | undefined>;
  validateUser(email: string, password: string): Promise<SafeUser | null>;
  getUserById(id: number): Promise<SafeUser | undefined>;
}

// PostgreSQL error code for a unique-constraint violation.
const UNIQUE_VIOLATION = '23505';

export class DbStorage implements IStorage {
  private getClient() {
    return db;
  }

  async createUser(userData: Omit<User, 'id'>): Promise<SafeUser> {
    try {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(userData.password, salt);
      const dbClient = this.getClient();

      const result = await dbClient.insert(users)
        .values({
          username: userData.username,
          email: userData.email,
          passwordHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({
          id: users.id,
          username: users.username,
          email: users.email,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });

      if (!result[0]) throw new Error('Failed to create user');
      return result[0];
    } catch (error: any) {
      if (error?.code === UNIQUE_VIOLATION || error?.message?.includes('unique constraint')) {
        throw new EmailInUseError();
      }
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<UserRecord | undefined> {
    const dbClient = this.getClient();
    const result = await dbClient.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async validateUser(email: string, password: string): Promise<SafeUser | null> {
    const user = await this.getUserByEmail(email);
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return null;

    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getUserById(id: number): Promise<SafeUser | undefined> {
    const dbClient = this.getClient();
    const result = await dbClient.select({
      id: users.id,
      username: users.username,
      email: users.email,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

    return result[0];
  }

  async saveArgument(argument: Argument, proof: Proof, userId: number): Promise<SyllogismRecord> {
    if (!argument.conclusion) throw new Error('Conclusion is required');

    const dbClient = this.getClient();
    const result = await dbClient.insert(syllogisms)
      .values({
        userId,
        name: argument.name || 'Untitled Argument',
        premises: argument.premises,
        conclusion: argument.conclusion,
        proof,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (!result[0]) throw new Error('Failed to save argument');
    return result[0];
  }

  async getArgument(id: number, userId: number): Promise<SyllogismRecord | undefined> {
    const dbClient = this.getClient();
    const result = await dbClient.select()
      .from(syllogisms)
      .where(and(eq(syllogisms.id, id), eq(syllogisms.userId, userId)))
      .limit(1);

    return result[0];
  }

  async listArguments(userId: number): Promise<SyllogismRecord[]> {
    const dbClient = this.getClient();
    return await dbClient.select()
      .from(syllogisms)
      .where(eq(syllogisms.userId, userId))
      .orderBy(desc(syllogisms.updatedAt), desc(syllogisms.id));
  }

  async updateArgument(id: number, userId: number, argument: Argument, proof: Proof): Promise<SyllogismRecord | undefined> {
    if (!argument.conclusion) throw new Error('Conclusion is required');

    const dbClient = this.getClient();
    const result = await dbClient.update(syllogisms)
      .set({
        name: argument.name || 'Untitled Argument',
        premises: argument.premises,
        conclusion: argument.conclusion,
        proof,
        updatedAt: new Date(),
      })
      .where(and(eq(syllogisms.id, id), eq(syllogisms.userId, userId)))
      .returning();

    return result[0];
  }

  async deleteArgument(id: number, userId: number): Promise<boolean> {
    const dbClient = this.getClient();
    const deleted = await dbClient.delete(syllogisms)
      .where(and(eq(syllogisms.id, id), eq(syllogisms.userId, userId)))
      .returning({ id: syllogisms.id });
    return deleted.length > 0;
  }
}

export const storage: IStorage = new DbStorage();
