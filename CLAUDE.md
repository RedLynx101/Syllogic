# CLAUDE.md - Syllogic Project Guidelines

## Build Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run check` - Run TypeScript type checking
- `npm run db:push` - Push schema changes to database

## Code Style Guidelines

### Structure
- Client-side code in `/client/src/`
- Server-side code in `/server/`
- Shared code in `/shared/`

### Naming Conventions
- Components: PascalCase (ProofDisplay, PremiseInput)
- Functions/Variables: camelCase (addPremise, checkValidity)
- Files: PascalCase for components (.tsx), camelCase for utilities (.ts)

### Imports & Organization
- External libraries first, then internal imports
- Use path aliases: `@/` for local, `@shared/` for shared code
- Group related state variables together

### Type Safety
- Use TypeScript with strict typing
- Define prop interfaces as `ComponentNameProps`
- Use Zod schemas for data validation

### Error Handling
- Use try/catch for async operations
- Provide meaningful error messages
- Use React Query for API error states