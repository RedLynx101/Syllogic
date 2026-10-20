// In-memory IStorage for API tests. It mirrors DbStorage's owner scoping so the route
// tests exercise the same contract the PostgreSQL implementation provides.
import bcrypt from "bcryptjs";
import type { Argument, Proof, SyllogismRecord, User, UserRecord } from "@shared/schema";
import type { IStorage, SafeUser } from "../storage";
import { EmailInUseError } from "../errors";

export class MemoryStorage implements IStorage {
  private users: UserRecord[] = [];
  private arguments: SyllogismRecord[] = [];
  private nextUserId = 1;
  private nextArgumentId = 1;

  reset() {
    this.users = [];
    this.arguments = [];
    this.nextUserId = 1;
    this.nextArgumentId = 1;
  }

  /** Test helper: the stored row regardless of owner, to check that nothing changed. */
  peekArgument(id: number): SyllogismRecord | undefined {
    return this.arguments.find((a) => a.id === id);
  }

  /** Test helper: insert a row with an arbitrary owner (including none). */
  insertRaw(record: Omit<SyllogismRecord, "id">): SyllogismRecord {
    const row = { ...record, id: this.nextArgumentId++ };
    this.arguments.push(row);
    return row;
  }

  private safe(user: UserRecord): SafeUser {
    const { passwordHash: _hash, ...rest } = user;
    return rest;
  }

  async createUser(user: Omit<User, "id">): Promise<SafeUser> {
    if (this.users.some((u) => u.email === user.email)) throw new EmailInUseError();
    const now = new Date();
    const row: UserRecord = {
      id: this.nextUserId++,
      username: user.username,
      email: user.email,
      passwordHash: await bcrypt.hash(user.password, 4),
      createdAt: now,
      updatedAt: now,
    };
    this.users.push(row);
    return this.safe(row);
  }

  async getUserByEmail(email: string) {
    return this.users.find((u) => u.email === email);
  }

  async validateUser(email: string, password: string) {
    const user = await this.getUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
    return this.safe(user);
  }

  async getUserById(id: number) {
    const user = this.users.find((u) => u.id === id);
    return user ? this.safe(user) : undefined;
  }

  async saveArgument(argument: Argument, proof: Proof, userId: number) {
    if (!argument.conclusion) throw new Error("Conclusion is required");
    const now = new Date();
    return this.insertRaw({
      userId,
      name: argument.name || "Untitled Argument",
      premises: argument.premises,
      conclusion: argument.conclusion,
      proof,
      createdAt: now,
      updatedAt: now,
    });
  }

  async getArgument(id: number, userId: number) {
    return this.arguments.find((a) => a.id === id && a.userId === userId);
  }

  async listArguments(userId: number) {
    return this.arguments
      .filter((a) => a.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.id - a.id);
  }

  async updateArgument(id: number, userId: number, argument: Argument, proof: Proof) {
    const row = await this.getArgument(id, userId);
    if (!row || !argument.conclusion) return undefined;
    Object.assign(row, {
      name: argument.name || "Untitled Argument",
      premises: argument.premises,
      conclusion: argument.conclusion,
      proof,
      updatedAt: new Date(),
    });
    return row;
  }

  async deleteArgument(id: number, userId: number) {
    const before = this.arguments.length;
    this.arguments = this.arguments.filter((a) => !(a.id === id && a.userId === userId));
    return this.arguments.length < before;
  }
}
