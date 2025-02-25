import { 
  type Argument, 
  type Proof, 
  type SyllogismRecord, 
  type User,
  type UserRecord,
  syllogisms,
  users
} from "@shared/schema";
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { and, eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/syllogic';
console.log('Database connection string:', DATABASE_URL.replace(/:[^:]*@/, ':****@'));

const getDrizzleClient = () => {
  try {
    const sql = neon(DATABASE_URL);
    return drizzle(sql, { logger: true });
  } catch (error) {
    console.error('Error creating database client:', error);
    throw new Error('Failed to initialize database connection');
  }
};

// Initialize the client once and reuse it
const db = getDrizzleClient();

// Export the initialized client
export { db };

export interface IStorage {
  saveArgument(argument: Argument, proof: Proof, userId?: number): Promise<SyllogismRecord>;
  getArgument(id: number): Promise<SyllogismRecord | undefined>;
  listArguments(userId?: number): Promise<SyllogismRecord[]>;
  updateArgument(id: number, argument: Argument, proof: Proof): Promise<SyllogismRecord | undefined>;
  deleteArgument(id: number): Promise<boolean>;
  createUser(user: Omit<User, 'id'>): Promise<Omit<UserRecord, 'passwordHash'>>;
  getUserByEmail(email: string): Promise<UserRecord | undefined>;
  validateUser(email: string, password: string): Promise<Omit<UserRecord, 'passwordHash'> | null>;
  getUserById(id: number): Promise<Omit<UserRecord, 'passwordHash'> | undefined>;
}

export class DbStorage implements IStorage {
  private getClient() {
    return getDrizzleClient();
  }

  async createUser(userData: Omit<User, 'id'>): Promise<Omit<UserRecord, 'passwordHash'>> {
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
      if (error.message?.includes('unique constraint')) {
        throw new Error('Email already in use');
      }
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<UserRecord | undefined> {
    const dbClient = this.getClient();
    const result = await dbClient.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async validateUser(email: string, password: string): Promise<Omit<UserRecord, 'passwordHash'> | null> {
    const user = await this.getUserByEmail(email);
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return null;

    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getUserById(id: number): Promise<Omit<UserRecord, 'passwordHash'> | undefined> {
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

  async saveArgument(argument: Argument, proof: Proof, userId?: number): Promise<SyllogismRecord> {
    if (!argument.conclusion) throw new Error('Conclusion is required');

    const dbClient = this.getClient();
    const result = await dbClient.insert(syllogisms)
      .values({
        userId: userId || null,
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

  async getArgument(id: number): Promise<SyllogismRecord | undefined> {
    const dbClient = this.getClient();
    const result = await dbClient.select()
      .from(syllogisms)
      .where(eq(syllogisms.id, id))
      .limit(1);

    return result[0];
  }

  async listArguments(userId?: number): Promise<SyllogismRecord[]> {
    const dbClient = this.getClient();
    let query = dbClient.select().from(syllogisms);

    if (userId) {
      query = query.where(eq(syllogisms.userId, userId));
    }

    return await query.orderBy(syllogisms.updatedAt);
  }

  async updateArgument(id: number, argument: Argument, proof: Proof): Promise<SyllogismRecord | undefined> {
    if (!argument.conclusion) throw new Error('Conclusion is required');

    const dbClient = this.getClient();
    const result = await dbClient.update(syllogisms)
      .set({
        name: argument.name,
        premises: argument.premises,
        conclusion: argument.conclusion,
        proof,
        updatedAt: new Date(),
      })
      .where(eq(syllogisms.id, id))
      .returning();

    return result[0];
  }

  async deleteArgument(id: number): Promise<boolean> {
    const dbClient = this.getClient();
    await dbClient.delete(syllogisms).where(eq(syllogisms.id, id));
    return true;
  }
}

// Switch to using the database implementation
console.log('Using PostgreSQL database for storage');
export const storage: IStorage = new DbStorage();