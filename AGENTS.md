<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean
# Cairo SciVerse - Technical Guidelines & Agent Rules

## Project Overview
Cairo SciVerse is an internal management and collaboration web application built for teams, members, and leaders.
The application handles user authentication, team management, task assignments with degrees/scoring, and team messaging.

## Tech Stack
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript (Strict Mode)
- **Database:** PostgreSQL (with `pg` / Kysely / Prisma or raw SQL pool)
- **UI & Styling:** React 19, Tailwind CSS v4
- **Optimization:** React Compiler Enabled (`experimental.reactCompiler: true`)
- **State & Real-time:** WebSockets / Socket.io for messaging
- **Automation Tools:** Custom Baileys (WhatsApp Node Script) for password delivery

## Architecture & Directory Conventions
Always respect the path aliases defined in `tsconfig.json`:
- `@/*` -> `./src/*`
- `@components/*` -> `./src/components/*`
- `@lib/*` -> `./src/lib/*`
- `@actions/*` -> `./src/actions/*`
- `@types/*` -> `./src/types/*`

### Folder Structure
- `src/app/`: Next.js 16 App Router pages and Server Actions.
- `src/components/ui/`: Reusable primitives and UI components.
- `src/components/modules/`: Domain-specific components (e.g., `MyTeam`, `OtherTeams`, `Chat`, `Profile`).
- `src/lib/`: Database connection (`db.ts`), auth utility functions, and encryption helpers.
- `src/types/`: TypeScript definitions and database models.
- `scripts/`: Independent background scripts (e.g., WhatsApp notification scripts).

## Code Style & Standards

### 1. TypeScript Rules
- Never use `any`. Always define strict interfaces or types in `@types`.
- Use explicit Enums or Union Types for roles and statuses:
  `type Role = 'Leader' | 'Member' | 'Admin';`
- Ensure full type safety across Server Actions and API Routes.

### 2. Next.js 16 Standards
- Prefer Server Components (`RSC`) by default.
- Use `'use client'` only when interaction, state, or hooks (e.g., `useState`, `useEffect`) are strictly required.
- Do not write manual `useMemo` or `useCallback` unless necessary, as **React Compiler** is enabled.
- Use Server Actions for data mutations (task creation, degree submission, profile updates).

### 3. Database & Security
- Passwords MUST be hashed using `bcrypt` / Argon2 (never store raw passwords).
- Always format phone numbers into international format (`+20...`).
- Strictly guard Leader-only endpoints and UI actions by validating `role === 'Leader'` on the server side.

### 4. UI / UX Design Consistency
- UI must match the approved Figma / Design System screens:
  - Navigation tabs: `My Team`, `Other Teams`, `Messages`, `Profile`.
  - Dynamic display for Leaders vs Members (e.g., "Manage your Team" button visible only to Leaders).
  - Clean card layouts for tasks and message threads.

## Workflow Rules for AI Agents
1. **Never delete existing working logic:** Modify or extend modular functions instead of rewriting full files unnecessarily.
2. **Type Generation:** Always update `@types` whenever a database table schema changes.
3. **Error Handling:** Wrap Server Actions and API handlers in `try/catch` and return standardized result objects:
   `{ success: boolean, data?: T, error?: string }`.

<!-- END:nextjs-agent-rules -->
