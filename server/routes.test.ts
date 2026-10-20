import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import session from "express-session";
import request from "supertest";
import type { Premise } from "@shared/schema";

// Swap the PostgreSQL storage for an in-memory one before the routes import it.
vi.mock("./storage", async () => {
  const { MemoryStorage } = await import("./test/memory-storage");
  return { storage: new MemoryStorage() };
});

import { storage } from "./storage";
import { registerRoutes } from "./routes";
import type { MemoryStorage } from "./test/memory-storage";

const memory = storage as unknown as MemoryStorage;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "test-only-secret", resave: false, saveUninitialized: false }));
  registerRoutes(app);
  return app;
}

const A = (subject: string, predicate: string): Premise => ({ form: "A", subject, predicate });

const barbara = {
  name: "Barbara",
  premises: [A("humans", "mortal"), A("Greeks", "humans")],
  conclusion: A("Greeks", "mortal"),
};

const undistributedMiddle = {
  name: "Undistributed middle",
  premises: [A("humans", "mortal"), A("cats", "mortal")],
  conclusion: A("cats", "humans"),
};

/** Registers a fictional user and returns a cookie-carrying agent signed in as them. */
async function signUp(app: express.Express, username: string) {
  const agent = request.agent(app);
  const res = await agent
    .post("/api/auth/register")
    .send({ username, email: `${username}@example.test`, password: "Correct-horse-1" });
  expect(res.status).toBe(201);
  return { agent, id: res.body.user.id as number };
}

async function saveArgument(agent: ReturnType<typeof request.agent>, argument: object) {
  const res = await agent.post("/api/evaluate").send({ ...argument, save: true });
  expect(res.status).toBe(200);
  return res.body.savedArgument as { id: number; userId: number };
}

describe("saved-argument API", () => {
  let app: express.Express;

  beforeEach(() => {
    memory.reset();
    app = buildApp();
  });

  describe("when signed out", () => {
    it.each([
      ["get", "/api/arguments"],
      ["get", "/api/user/arguments"],
      ["get", "/api/arguments/1"],
      ["put", "/api/arguments/1"],
      ["delete", "/api/arguments/1"],
      ["get", "/api/auth/me"],
    ] as const)("refuses %s %s with 401", async (method, url) => {
      const { agent } = await signUp(app, "ada");
      const argument = await saveArgument(agent, barbara);
      expect(argument.id).toBe(1);

      const res = await request(app)[method](url).send(barbara);
      expect(res.status).toBe(401);
      expect(JSON.stringify(res.body)).not.toContain("Greeks");
    });

    it("still evaluates arguments but refuses to save them", async () => {
      const evaluated = await request(app).post("/api/evaluate").send(barbara);
      expect(evaluated.status).toBe(200);
      expect(evaluated.body.proof.isValid).toBe(true);
      expect(evaluated.body.savedArgument).toBeUndefined();

      const saved = await request(app).post("/api/evaluate").send({ ...barbara, save: true });
      expect(saved.status).toBe(401);
    });

    it("loses access after logging out", async () => {
      const { agent } = await signUp(app, "ada");
      const argument = await saveArgument(agent, barbara);
      expect((await agent.get(`/api/arguments/${argument.id}`)).status).toBe(200);

      expect((await agent.post("/api/auth/logout")).status).toBe(200);
      expect((await agent.get(`/api/arguments/${argument.id}`)).status).toBe(401);
      expect((await agent.get("/api/arguments")).status).toBe(401);
    });
  });

  describe("when signed in", () => {
    it("lists only the caller's own arguments, newest first", async () => {
      const ada = await signUp(app, "ada");
      const ben = await signUp(app, "ben");
      const first = await saveArgument(ada.agent, barbara);
      await saveArgument(ben.agent, undistributedMiddle);
      const second = await saveArgument(ada.agent, undistributedMiddle);

      for (const url of ["/api/arguments", "/api/user/arguments"]) {
        const res = await ada.agent.get(url);
        expect(res.status).toBe(200);
        expect(res.body.map((a: { id: number }) => a.id)).toEqual([second.id, first.id]);
        expect(res.body.every((a: { userId: number }) => a.userId === ada.id)).toBe(true);
      }
    });

    it("reads its own argument but gets 404 for someone else's", async () => {
      const ada = await signUp(app, "ada");
      const ben = await signUp(app, "ben");
      const adas = await saveArgument(ada.agent, barbara);
      const bens = await saveArgument(ben.agent, undistributedMiddle);

      const own = await ada.agent.get(`/api/arguments/${adas.id}`);
      expect(own.status).toBe(200);
      expect(own.body.name).toBe("Barbara");

      const other = await ada.agent.get(`/api/arguments/${bens.id}`);
      expect(other.status).toBe(404);
      expect(other.body).toEqual({ error: "Argument not found" });

      // Same response as an id that does not exist at all
      const missing = await ada.agent.get("/api/arguments/999");
      expect(missing.status).toBe(404);
      expect(missing.body).toEqual(other.body);
    });

    it("cannot update or delete someone else's argument", async () => {
      const ada = await signUp(app, "ada");
      const ben = await signUp(app, "ben");
      const bens = await saveArgument(ben.agent, undistributedMiddle);
      const before = structuredClone(memory.peekArgument(bens.id));

      const update = await ada.agent.put(`/api/arguments/${bens.id}`).send({ ...barbara, name: "Taken over" });
      expect(update.status).toBe(404);

      const del = await ada.agent.delete(`/api/arguments/${bens.id}`);
      expect(del.status).toBe(404);

      expect(memory.peekArgument(bens.id)).toEqual(before);
      expect((await ben.agent.get(`/api/arguments/${bens.id}`)).body.name).toBe("Undistributed middle");
    });

    it("treats arguments without an owner as not found", async () => {
      const ada = await signUp(app, "ada");
      const orphan = memory.insertRaw({
        userId: null,
        name: "Legacy",
        premises: barbara.premises,
        conclusion: barbara.conclusion,
        proof: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect((await ada.agent.get(`/api/arguments/${orphan.id}`)).status).toBe(404);
      expect((await ada.agent.put(`/api/arguments/${orphan.id}`).send(barbara)).status).toBe(404);
      expect((await ada.agent.delete(`/api/arguments/${orphan.id}`)).status).toBe(404);
      expect(memory.peekArgument(orphan.id)?.name).toBe("Legacy");
      expect((await ada.agent.get("/api/arguments")).body).toEqual([]);
    });

    it("updates its own argument and recomputes the proof on the server", async () => {
      const ada = await signUp(app, "ada");
      const saved = await saveArgument(ada.agent, undistributedMiddle);
      expect(memory.peekArgument(saved.id)?.proof?.isValid).toBe(false);

      const res = await ada.agent.put(`/api/arguments/${saved.id}`).send({ ...barbara, name: "Fixed" });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Fixed");
      expect(res.body.proof.isValid).toBe(true);
      expect(res.body.proof.steps.at(-1).rule).toBe("Barbara");
    });

    it("deletes its own argument", async () => {
      const ada = await signUp(app, "ada");
      const saved = await saveArgument(ada.agent, barbara);

      expect((await ada.agent.delete(`/api/arguments/${saved.id}`)).status).toBe(200);
      expect((await ada.agent.get(`/api/arguments/${saved.id}`)).status).toBe(404);
      expect((await ada.agent.delete(`/api/arguments/${saved.id}`)).status).toBe(404);
    });

    it.each(["abc", "1.5", "0", "-1", "12abc", "99999999999"])("rejects the malformed id %s with 400", async (id) => {
      const ada = await signUp(app, "ada");
      expect((await ada.agent.get(`/api/arguments/${id}`)).status).toBe(400);
      expect((await ada.agent.put(`/api/arguments/${id}`).send(barbara)).status).toBe(400);
      expect((await ada.agent.delete(`/api/arguments/${id}`)).status).toBe(400);
    });

    it("rejects an update without a conclusion", async () => {
      const ada = await signUp(app, "ada");
      const saved = await saveArgument(ada.agent, barbara);
      const res = await ada.agent.put(`/api/arguments/${saved.id}`).send({ premises: barbara.premises });
      expect(res.status).toBe(400);
    });
  });

  describe("accounts", () => {
    it("never returns the password hash", async () => {
      const ada = await signUp(app, "ada");
      const me = await ada.agent.get("/api/auth/me");
      expect(me.status).toBe(200);
      expect(me.body.user.username).toBe("ada");
      expect(me.body.user).not.toHaveProperty("passwordHash");
    });

    it("answers 409 for an email that is already registered", async () => {
      await signUp(app, "ada");
      const res = await request(app)
        .post("/api/auth/register")
        .send({ username: "ada2", email: "ada@example.test", password: "Correct-horse-1" });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/);
    });

    it("rejects a wrong password with 401", async () => {
      await signUp(app, "ada");
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "ada@example.test", password: "wrong-password" });
      expect(res.status).toBe(401);
    });

    it("answers malformed JSON with 400 rather than 500", async () => {
      const res = await request(app)
        .post("/api/evaluate")
        .set("Content-Type", "application/json")
        .send("{not json");
      expect(res.status).toBe(400);
    });
  });
});
