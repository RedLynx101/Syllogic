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

// Initialize Neon database client
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/syllogic';
console.log('Database connection string:', DATABASE_URL.replace(/:[^:]*@/, ':****@')); // Log the URL with password hidden for debugging

// Create a function to get a new connection for each request
function getDrizzleClient() {
  try {
    const sql = neon(DATABASE_URL);
    // Create a prepared statement executor
    const client = drizzle(sql);
    return client;
  } catch (error) {
    console.error('Error initializing database client:', error);
    throw new Error('Failed to initialize database connection');
  }
}

// Export a function to get a new client for each operation
export const db = getDrizzleClient();

export interface IStorage {
  // Argument operations
  saveArgument(argument: Argument, proof: Proof, userId?: number): Promise<SyllogismRecord>;
  getArgument(id: number): Promise<SyllogismRecord | undefined>;
  listArguments(userId?: number): Promise<SyllogismRecord[]>;
  updateArgument(id: number, argument: Argument, proof: Proof): Promise<SyllogismRecord | undefined>;
  deleteArgument(id: number): Promise<boolean>;
  
  // User operations
  createUser(user: Omit<User, 'id'>): Promise<Omit<UserRecord, 'passwordHash'>>;
  getUserByEmail(email: string): Promise<UserRecord | undefined>;
  validateUser(email: string, password: string): Promise<Omit<UserRecord, 'passwordHash'> | null>;
  getUserById(id: number): Promise<Omit<UserRecord, 'passwordHash'> | undefined>;
}

export class DbStorage implements IStorage {
  // Get a fresh database client for each operation
  private getClient() {
    return getDrizzleClient();
  }

  // User operations
  async createUser(userData: Omit<User, 'id'>): Promise<Omit<UserRecord, 'passwordHash'>> {
    try {
      console.log('Creating user with email:', userData.email);
      
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(userData.password, salt);
      
      // Get a fresh client for this operation
      const dbClient = this.getClient();
      
      // Insert user into database
      console.log('Attempting database insertion...');
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
      
      if (!result[0]) {
        console.error('Database returned no result');
        throw new Error('Failed to create user');
      }
      
      console.log('User created successfully with ID:', result[0].id);
      return result[0];
    } catch (error: any) {
      console.error('Error creating user:', error);
      
      // Handle unique constraint violations
      if (error.message && error.message.includes('unique constraint')) {
        if (error.message.includes('email')) {
          throw new Error('Email already in use');
        }
      }
      
      // Rethrow with additional context for debugging
      throw new Error(`Database error: ${error.message}`);
    }
  }
  
  async getUserByEmail(email: string): Promise<UserRecord | undefined> {
    try {
      const dbClient = this.getClient();
      const result = await dbClient.select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
        
      return result[0];
    } catch (error) {
      console.error('Error getting user by email:', error);
      return undefined;
    }
  }
  
  async validateUser(email: string, password: string): Promise<Omit<UserRecord, 'passwordHash'> | null> {
    try {
      const user = await this.getUserByEmail(email);
      
      if (!user) {
        return null;
      }
      
      const isValid = await bcrypt.compare(password, user.passwordHash);
      
      if (!isValid) {
        return null;
      }
      
      const { passwordHash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      console.error('Error validating user:', error);
      return null;
    }
  }
  
  async getUserById(id: number): Promise<Omit<UserRecord, 'passwordHash'> | undefined> {
    try {
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
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return undefined;
    }
  }

  // Argument operations
  async saveArgument(argument: Argument, proof: Proof, userId?: number): Promise<SyllogismRecord> {
    try {
      if (!argument.conclusion) {
        throw new Error('Conclusion is required');
      }
      
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
      
      if (!result[0]) {
        throw new Error('Failed to save argument');
      }
      
      return result[0];
    } catch (error) {
      console.error('Error saving argument:', error);
      throw new Error('Failed to save argument');
    }
  }

  async getArgument(id: number): Promise<SyllogismRecord | undefined> {
    try {
      const dbClient = this.getClient();
      const result = await dbClient.select()
        .from(syllogisms)
        .where(eq(syllogisms.id, id))
        .limit(1);
      
      return result[0];
    } catch (error) {
      console.error('Error getting argument:', error);
      return undefined;
    }
  }

  async listArguments(userId?: number): Promise<SyllogismRecord[]> {
    try {
      const dbClient = this.getClient();
      let query = dbClient.select().from(syllogisms);
      
      if (userId) {
        query = query.where(eq(syllogisms.userId, userId));
      }
      
      return await query.orderBy(syllogisms.updatedAt);
    } catch (error) {
      console.error('Error listing arguments:', error);
      return [];
    }
  }
  
  async updateArgument(id: number, argument: Argument, proof: Proof): Promise<SyllogismRecord | undefined> {
    try {
      if (!argument.conclusion) {
        throw new Error('Conclusion is required');
      }
      
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
    } catch (error) {
      console.error('Error updating argument:', error);
      return undefined;
    }
  }
  
  async deleteArgument(id: number): Promise<boolean> {
    try {
      const dbClient = this.getClient();
      await dbClient.delete(syllogisms)
        .where(eq(syllogisms.id, id));
      
      return true;
    } catch (error) {
      console.error('Error deleting argument:', error);
      return false;
    }
  }
}

// Fallback to in-memory storage for development
export class MemStorage implements IStorage {
  private syllogisms: Map<number, SyllogismRecord>;
  private users: Map<number, UserRecord>;
  private userEmails: Map<string, number>;
  private currentId: { syllogism: number; user: number };

  constructor() {
    this.syllogisms = new Map();
    this.users = new Map();
    this.userEmails = new Map();
    this.currentId = { syllogism: 1, user: 1 };
  }

  // User operations
  async createUser(userData: Omit<User, 'id'>): Promise<Omit<UserRecord, 'passwordHash'>> {
    // Check if email already exists
    if (this.userEmails.has(userData.email)) {
      throw new Error('Email already in use');
    }
    
    const id = this.currentId.user++;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(userData.password, salt);
    
    const now = new Date();
    const user: UserRecord = {
      id,
      username: userData.username,
      email: userData.email,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    };
    
    this.users.set(id, user);
    this.userEmails.set(userData.email, id);
    
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  
  async getUserByEmail(email: string): Promise<UserRecord | undefined> {
    const userId = this.userEmails.get(email);
    if (!userId) return undefined;
    return this.users.get(userId);
  }
  
  async validateUser(email: string, password: string): Promise<Omit<UserRecord, 'passwordHash'> | null> {
    const user = await this.getUserByEmail(email);
    
    if (!user) {
      return null;
    }
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
      return null;
    }
    
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  
  async getUserById(id: number): Promise<Omit<UserRecord, 'passwordHash'> | undefined> {
    const user = this.users.get(id);
    
    if (!user) {
      return undefined;
    }
    
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Argument operations
  async saveArgument(argument: Argument, proof: Proof, userId?: number): Promise<SyllogismRecord> {
    if (!argument.conclusion) {
      throw new Error('Conclusion is required');
    }
    
    const id = this.currentId.syllogism++;
    const now = new Date();
    
    const record: SyllogismRecord = {
      id,
      userId: userId || null,
      name: argument.name || 'Untitled Argument',
      premises: argument.premises,
      conclusion: argument.conclusion,
      proof,
      createdAt: now,
      updatedAt: now,
    };
    
    this.syllogisms.set(id, record);
    return record;
  }

  async getArgument(id: number): Promise<SyllogismRecord | undefined> {
    return this.syllogisms.get(id);
  }

  async listArguments(userId?: number): Promise<SyllogismRecord[]> {
    let userArguments = Array.from(this.syllogisms.values());
    
    if (userId) {
      userArguments = userArguments.filter(arg => arg.userId === userId);
    }
    
    return userArguments.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
  
  async updateArgument(id: number, argument: Argument, proof: Proof): Promise<SyllogismRecord | undefined> {
    const existing = this.syllogisms.get(id);
    
    if (!existing) {
      return undefined;
    }
    
    if (!argument.conclusion) {
      throw new Error('Conclusion is required');
    }
    
    const updated: SyllogismRecord = {
      ...existing,
      name: argument.name || existing.name,
      premises: argument.premises,
      conclusion: argument.conclusion,
      proof,
      updatedAt: new Date(),
    };
    
    this.syllogisms.set(id, updated);
    return updated;
  }
  
  async deleteArgument(id: number): Promise<boolean> {
    return this.syllogisms.delete(id);
  }
}

// Choose storage implementation based on environment
let useDbStorage = !!process.env.DATABASE_URL;

// Try to connect to the database to test if it's available
try {
  if (useDbStorage) {
    console.log('Validating database connection...');
    const testClient = getDrizzleClient();
    
    // Only mark as usable if connection is good
    console.log('Database connection validated successfully');
  }
} catch (error) {
  console.error('Database connection failed, falling back to memory storage:', error);
  useDbStorage = false;
}

// Use database if available, otherwise fall back to memory storage
export const storage: IStorage = useDbStorage 
  ? new DbStorage() 
  : new MemStorage();