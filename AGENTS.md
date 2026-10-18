# AI Agent Instructions

## 1. Mission
Build **EthioDev** according to the project's approved requirements and existing codebase. Prefer correct, maintainable, secure, and testable solutions over the fastest-looking implementation.

## 2. Read the relevant context
Before making changes, inspect the repository and read the documents relevant to the task:
- `PRD.md` — product goals, scope, and acceptance criteria
- `APP_FLOW.md` — journeys, screens, and interaction states
- `DESIGN.md` — visual and interaction conventions
- `ARCHITECTURE.md` — system boundaries and technical decisions
- `SCHEMA.md` — data structures and invariants
- `TASKS.md` — task order, dependencies, and completion status
- `README.md` — setup and commands

Do not assume a document applies where the project does not use that capability. Follow repository-specific instructions as well.

## 3. Working rules
- Inspect existing code before proposing or implementing changes.
- Work on one well-defined task at a time; avoid unrelated refactors.
- Follow established patterns and the architecture unless there is a clear reason to change them.
- Prefer simple, readable solutions over unnecessary abstractions or dependencies.
- Do not invent product behavior when requirements are unclear. Record the ambiguity and ask for a decision if it materially affects scope, data, security, or user experience.
- Treat user input and external data as untrusted.
- Never expose secrets, credentials, private data, or sensitive values in code, logs, tests, or documentation.
- Do not claim a task or test passed unless it was actually verified.
- Do not overwrite user changes or perform destructive operations without permission.

## 4. Implementation expectations
- Keep components, modules, and functions focused.
- Validate data at appropriate boundaries.
- Enforce authorization on the server or trusted backend, not only in the UI.
- Handle loading, empty, success, validation, and error states where relevant.
- Use accessible semantic elements and keyboard-friendly interactions.
- Add or update tests for changed behavior and important edge cases.
- Update documentation when behavior, architecture, schema, setup, or decisions change.

## 5. Verification
Before marking a task complete:
1. Check its acceptance criteria in `TASKS.md` and the relevant requirements.
2. Run applicable tests, linting, type checks, and build commands available in the project.
3. Review the diff for regressions, accidental files, secrets, and unrelated changes.
4. Report what changed, what was verified, and anything not verified.

If a check cannot be run, state why. Do not silently substitute an assumption for a passing result.

## 6. Documentation and conflicts
- Keep documentation aligned with the implemented system.
- Use stable IDs such as `F-01`, `J-01`, and `T-01` when linking requirements, journeys, and tasks.
- If documents conflict, identify the conflict. Prefer an explicit approved decision over an outdated or inferred statement; ask for clarification when the conflict is consequential.
- Keep `TASKS.md` status current, but do not mark work complete until its checks pass.

## 7. Project-specific instructions
- **Package manager / runtime:** React, Vite, and JavaScript with Node.js LTS and npm. Pin/document the installed Node LTS version when scaffolding.
- **Quality tools:** ESLint, Prettier, Vitest with React Testing Library, and Playwright.
- **Required commands** (run from the application project directory): `npm install`, `npm run dev`, `npm run lint`, `npm run format:check`, `npm test`, `npm run test:e2e`, and `npm run build`. Do not claim commands pass unless they have been run.
- **Additional constraints:**
  - The MVP uses Supabase for Auth, PostgreSQL, Realtime, and Storage. Do not add Express or Socket.IO to the MVP.
  - React may call Supabase directly. Enforce permissions with PostgreSQL RLS and trusted database functions; UI checks are not authorization.
  - Keep all hosting and third-party services on free plans. Do not introduce paid dependencies or upgrades without an approved product decision.
  - Never expose Supabase service-role keys, SMTP credentials, or other privileged secrets in browser code or source control.
  - Keep implementation aligned with `docs/PRD.md`, `docs/APP_FLOW.md`, `docs/DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/SCHEMA.md`, and `docs/TASKS.md`. If consequential requirements conflict, identify the conflict and resolve it before implementation.
