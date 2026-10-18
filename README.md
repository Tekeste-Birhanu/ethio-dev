# EthioDev

EthioDev is a mobile-friendly collaboration platform for beginner and junior developers across Ethiopia. Developers can discover project opportunities, find collaborators, coordinate through chat and shared workspaces, and showcase completed projects.

## MVP features

- Public developer profiles, directory, and project opportunity discovery.
- Opportunity publishing, likes, threaded comments, and collaboration requests.
- Private chat, team workspaces, tasks, and milestones.
- Public showcases for completed projects.
- Email/password and Google sign-in, with in-app notifications.

## Status

T-01, the product foundation, is complete: the React/Vite scaffold and JavaScript quality toolchain are in place; schema, authorization, and Storage migrations are applied and verified on the hosted development project. T-02, the responsive app shell, is complete. T-03 is complete: the hosted project is linked, bucket configuration passed migration preflight, all three migrations are applied with matching local and remote history, and RLS is enabled on every public table and `storage.objects`. T-04 through T-19 have not started. Unit and browser test files have not been added yet. The specification files define the intended behavior; `docs/TASKS.md` tracks the implementation work.

## Documentation

- [Product requirements](docs/PRD.md)
- [Application flows](docs/APP_FLOW.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Design and UX](docs/DESIGN.md)
- [Data schema](docs/SCHEMA.md)
- [Implementation tasks](docs/TASKS.md)
- [AI agent instructions](AGENTS.md)

## Planned stack

- **Frontend:** React, Vite, JavaScript
- **Runtime / package manager:** Node.js LTS and npm
- **Code quality and tests:** ESLint, Prettier, Vitest, React Testing Library, and Playwright
- **Backend platform and database:** Supabase (Auth, PostgreSQL, Realtime, and Storage)
- **Transactional email:** Brevo through Supabase Auth SMTP
- **Hosting:** Free static frontend host to be selected at deployment

All hosting and third-party services must remain on free plans for the MVP. Express and Socket.IO are not part of the MVP.

## Setup and development commands

Use Node.js **24.20.0** and npm **11.19.0**. From the repository root, install dependencies and start the development server:

```sh
npm ci
npm run dev
```

## Hosted Supabase development

Use a free Supabase development project; this workflow does not require Docker. First create the four private buckets listed in [SCHEMA.md](docs/SCHEMA.md) from the project’s **Storage** page. Set each bucket’s file limit to 10 MiB; allow JPEG, PNG, GIF, and WebP for the two media buckets, and the chat attachment types listed in the schema for the attachment buckets. Then sign in to the CLI, link the repository to the project ref, review pending migrations, and apply them:

```sh
npm run supabase:login
npm run supabase:link -- --project-ref <project-ref>
npm run supabase:migrations
npm run supabase:push:dry-run
npm run supabase:push
```

The link command asks for the database password. Never put it in source control. Get the project URL and publishable key from the Supabase Dashboard and add them to an untracked `.env.local` file using the names in `.env.example`. The app only creates its Supabase client when both values are present. No seed data is configured.

The Supabase CLI and client library are project dependencies. CLI configuration is in `supabase/config.toml`, and schema changes belong in timestamped files under `supabase/migrations/`. Hosted Auth, Storage, and redirect settings are managed in the Supabase Dashboard. Never use a service-role key in the browser. Use a development project for migration work; do not link or push to production during setup.

Available quality and build commands:

```sh
npm run lint
npm run format:check
npm test
npm run test:e2e
npm run build
npm run preview
```

`npm test` runs Vitest with jsdom and React Testing Library. `npm run test:e2e` runs Playwright in Chromium; install its browser once with `npx playwright install chromium`. The test commands succeed when no test files exist and will run matching tests when added. `.env.example` lists the public Supabase client variables; client setup is in place, but the hosted project is not linked or configured yet. Never place service-role keys or email credentials in browser environment variables. The T-01 schema, access, and Storage migrations are in `supabase/migrations/`; hosted project linking and migration application are tracked in T-03. No fictional records or reset jobs are planned; reviewers can create persistent records through the product. See [Implementation tasks](docs/TASKS.md) for the sequence.

## Deployment

Deployment provider and project-specific steps will be added when the application is ready to deploy. The MVP is intended to use a free hosting URL and free service plans.

## Contributing / AI-assisted development

Follow [AGENTS.md](AGENTS.md), select an actionable task from [docs/TASKS.md](docs/TASKS.md), and consult the relevant specifications before changing code. Verify acceptance criteria before marking a task complete.
