<p align="center">
  <img src="client/public/favicon.png" alt="Syllogic logo" width="96" height="96">
</p>

# Syllogic

Syllogic is a web app for checking categorical syllogisms. You write an argument as
premises in the classical **A / E / I / O** forms, add the conclusion you want to test,
and the app either builds a numbered formal proof or reports that the conclusion does
not follow from the premises with the rules it knows. Signed-in users can save their
arguments and view, edit or delete them later from a **My Arguments** page.

![Building a Barbara proof in Syllogic](docs/media/syllogic-proof-demo.gif)

## What it does

- **Argument editor.** 2 to 50 premises plus a conclusion. Each statement has a form
  selector (A/E/I/O), a subject term and a predicate term. A **Negative** checkbox on
  either term turns it into its complement (`non-mortal`); double negations cancel
  (`non-non-x` is read as `x`).
- **Proof engine.** [`client/src/lib/syllogism.ts`](client/src/lib/syllogism.ts) runs on
  the server (the Express API imports the same file). It repeatedly combines the
  statements it has, adds each new conclusion as a numbered step, and stops when it
  reaches the target conclusion, runs out of new statements, or hits 500 generated
  steps. A valid result is trimmed to the steps the conclusion actually depends on.
- **Accounts and saved arguments.** Register and log in with email and password
  (bcrypt-hashed). Sessions live in PostgreSQL. Saved arguments are listed on
  **My Arguments** with a validity badge, search, view, edit and delete.

Evaluating an argument never stores it; only the **Save** / **Update** buttons do.

![My Arguments page listing six saved arguments with Valid and Invalid badges](docs/media/syllogic-my-arguments.png)

## The four statement forms

| Code | Form              | Name                   | Editor label   |
|------|-------------------|------------------------|----------------|
| A    | All S are P       | Universal affirmative  | All (A)        |
| E    | No S are P        | Universal negative     | No (E)         |
| I    | Some S are P      | Particular affirmative | Some (I)       |
| O    | Some S are not P  | Particular negative    | Some not (O)   |

## Example: a Barbara proof

Premises *All humans are mortal* and *All Greeks are humans*, conclusion
*All Greeks are mortal*. The proof panel shows:

```text
Valid Argument
The conclusion follows from the premises using valid syllogistic rules.

1.  A - humans are mortal     Premise
2.  A - Greeks are humans     Premise
3.  A - Greeks are mortal     Barbara (from steps 1, 2)
■ End of Proof
```

Derived steps feed back into the search, so chains work too. With the premises
*All squares are rectangles*, *All rectangles are parallelograms* and
*All parallelograms are polygons*, the conclusion *All squares are polygons* is proved
in two Barbara steps (4: rectangles are polygons, from 2 and 3; 5: squares are
polygons, from 1 and 4).

If the conclusion cannot be derived, the panel says **Invalid Argument** and lists
the premises and anything it did derive along the way.

## Supported rules (and what that means)

The engine implements exactly two syllogistic rules and three immediate inferences:

| Rule            | Pattern                                             |
|-----------------|-----------------------------------------------------|
| Barbara         | All M are P, All S are M ⊢ All S are P              |
| Darii           | All M are P, Some S are M ⊢ Some S are P            |
| Obversion       | A, E, I and O statements (e.g. All S are P ⇔ No S are non-P) |
| Conversion      | E and I statements only (No S are P ⇔ No P are S)   |
| Contraposition  | A and O statements only (All S are P ⇔ All non-P are non-S) |

Before applying Barbara or Darii, each statement is expanded into its equivalent forms
under those immediate inferences. That is how the checker also handles the other moods
that are valid without existential import: Celarent, Ferio, Cesare, Camestres,
Festino, Baroco, Disamis, Datisi, Bocardo, Ferison, Camenes, Dimaris and Fresison are
all accepted, because they reduce to Barbara or Darii. The test suite checks all 15 of
those moods.

Limits worth knowing:

- The proof labels a reduced mood by the rule that finished it (a Celarent argument
  shows a **Barbara** step). The obversion/conversion/contraposition rewrites used on
  the way are not listed as separate numbered steps, and a conclusion that is simply
  an equivalent rewrite of one premise is marked valid with only the premises listed.
- There is no existential import or subalternation, so the 9 "weakened" or
  conditionally valid moods (Barbari, Celaront, Cesaro, Camestros, Darapti, Felapton,
  Bramantip, Fesapo, Calemos) are reported invalid. The tests check this as well.
- "Invalid" means "not derivable with these rules"; the app does not produce a
  counterexample.
- Terms are matched as exact strings: `Greek` and `Greeks` are different terms, and so
  are `Greeks` and `greeks`.

## Stack

- **Client:** React 18, Vite 5, TypeScript, Tailwind CSS with shadcn/ui (Radix)
  components, wouter for routing, TanStack Query.
- **Server:** Express 4 (TypeScript via tsx in development, bundled with esbuild for
  production), express-session with connect-pg-simple, bcryptjs.
- **Data:** PostgreSQL through Drizzle ORM and node-postgres (`pg`); schema in
  [`shared/schema.ts`](shared/schema.ts), validated with zod on both sides.
- **Tests:** vitest for the proof engine.
- No AI or external APIs are involved; the checker is deterministic code.

## Running locally

Requirements: Node.js 20 or newer (tested on 24) and a PostgreSQL database (tested
on 16).

### Environment variables

| Name             | Required | Purpose |
|------------------|----------|---------|
| `DATABASE_URL`   | Yes      | PostgreSQL connection string. The server refuses to start without it. |
| `SESSION_SECRET` | In production | Signs the session cookie. Required when `NODE_ENV=production`; in development a random secret is generated per process (sessions reset on restart). |
| `PORT`           | No       | HTTP port, default `5000`. |

The app does not read a `.env` file; export the variables in your shell.

### Steps

```bash
# 1. A throwaway PostgreSQL (or point DATABASE_URL at any existing database)
docker run --rm -d --name syllogic-pg -e POSTGRES_PASSWORD=change-me \
  -e POSTGRES_DB=syllogic -p 5432:5432 postgres:16

# 2. Environment
export DATABASE_URL="postgresql://postgres:change-me@localhost:5432/syllogic"
export SESSION_SECRET="$(openssl rand -hex 32)"
export PORT=5000

# 3. Install, create the tables, start the dev server
npm install
npm run db:push
npm run dev          # http://localhost:5000
```

PowerShell uses `$env:DATABASE_URL = "..."` (and so on) instead of `export`.

### Other scripts

| Script              | What it does |
|---------------------|--------------|
| `npm test`          | Runs the proof-engine tests (vitest). |
| `npm run check`     | TypeScript type check. |
| `npm run build`     | Builds the client into `dist/public` and bundles the server into `dist/index.js`. |
| `npm start`         | Runs the production build (`NODE_ENV=production`; POSIX shell syntax). On Windows, set `NODE_ENV=production` and run `node dist/index.js`. |
| `npm run db:migrate`| Creates the two tables with plain SQL, for environments without drizzle-kit. |

In production the session cookie is marked `secure`, so serve the app over HTTPS
(the server trusts one proxy hop for that).

## Project layout

```text
client/                 React app (Vite root)
  src/lib/syllogism.ts  Proof engine, shared with the server
  src/pages/            home (editor + proof), dashboard, auth/login, auth/register
server/                 Express API, session setup, Drizzle storage, Vite dev middleware
shared/schema.ts        Drizzle tables and zod schemas used by client and server
migrations/             drizzle-kit SQL migration
```

## Known gaps

- `GET /api/arguments` and `GET /api/arguments/:id` are not authenticated, so anyone
  who can reach the server can read saved arguments. Editing and deleting require the
  signed-in owner.
- The footer links to Privacy and Terms pages that do not exist yet.

## License

[MIT](LICENSE)
