import { type Argument, type Proof, type SyllogismRecord } from "@shared/schema";

export interface IStorage {
  saveArgument(argument: Argument, proof: Proof): Promise<SyllogismRecord>;
  getArgument(id: number): Promise<SyllogismRecord | undefined>;
  listArguments(): Promise<SyllogismRecord[]>;
}

export class MemStorage implements IStorage {
  private syllogisms: Map<number, SyllogismRecord>;
  private currentId: number;

  constructor() {
    this.syllogisms = new Map();
    this.currentId = 1;
  }

  async saveArgument(argument: Argument, proof: Proof): Promise<SyllogismRecord> {
    const id = this.currentId++;
    const record: SyllogismRecord = {
      id,
      premises: argument.premises,
      conclusion: argument.conclusion!,
      proof,
    };
    this.syllogisms.set(id, record);
    return record;
  }

  async getArgument(id: number): Promise<SyllogismRecord | undefined> {
    return this.syllogisms.get(id);
  }

  async listArguments(): Promise<SyllogismRecord[]> {
    return Array.from(this.syllogisms.values());
  }
}

export const storage = new MemStorage();