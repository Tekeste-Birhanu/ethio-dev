# EthioDev

EthioDev is a mobile-friendly collaboration platform for beginner and junior developers across Ethiopia. Developers can discover project opportunities, find collaborators, coordinate through chat and shared workspaces, and showcase completed projects.

## MVP features

- Public developer profiles, directory, and project opportunity discovery.
- Opportunity publishing, likes, threaded comments, and collaboration requests.
- Private chat, team workspaces, tasks, and milestones.
- Public showcases for completed projects.
- Email/password and Google sign-in, with in-app notifications.

## Status

T-01, the product foundation, is in progress: the React/Vite scaffold and JavaScript quality toolchain are complete; core schema and authorization migrations are drafted; Storage setup has not started. T-02, the responsive app shell, is complete. T-03 through T-19 have not started. Lint, formatting checks, and production build pass on Node.js 24.20.0 and npm 11.19.0. Unit and browser test files have not been added yet. The specification files define the intended behavior; `docs/TASKS.md` tracks the implementation work.

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

Available quality and build commands:

```sh
npm run lint
npm run format:check
npm test
npm run test:e2e
npm run build
npm run preview
```

`npm test` runs Vitest with jsdom and React Testing Library. `npm run test:e2e` runs Playwright in Chromium; install its browser once with `npx playwright install chromium`. The test commands succeed when no test files exist and will run matching tests when added. `.env.example` contains placeholders for future public Supabase client settings; Supabase integration is not configured yet. Never place service-role keys or email credentials in browser environment variables. The T-01 core schema is in `supabase/migrations/`; database project configuration and migration application are planned in T-03. No fictional records or reset jobs are planned; reviewers can create persistent records through the product. See [Implementation tasks](docs/TASKS.md) for the sequence.

## Deployment

Deployment provider and project-specific steps will be added when the application is ready to deploy. The MVP is intended to use a free hosting URL and free service plans.

## Contributing / AI-assisted development

Follow [AGENTS.md](AGENTS.md), select an actionable task from [docs/TASKS.md](docs/TASKS.md), and consult the relevant specifications before changing code. Verify acceptance criteria before marking a task complete.
