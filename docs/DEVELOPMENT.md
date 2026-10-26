# Local development

## Requirements

- Node.js 24 or newer
- npm (included with Node.js)
- Git

## Install dependencies

From the repository root, run:

```powershell
npm.cmd --prefix client install
npm.cmd --prefix server install
```

## Configure the server

If `server/.env` does not exist, copy the example:

```powershell
Copy-Item server/.env.example server/.env
```

Set `DATABASE_URL` in `server/.env` to your local PostgreSQL connection. Replace the password placeholder and keep the real credentials private. URL-encode special characters in the password. `PORT` defaults to `3000` and `CLIENT_ORIGIN` defaults to `http://localhost:5173`.

For Google sign-in, create a **Web application** OAuth client. Add `http://localhost:3000/api/auth/google/callback` as an authorized redirect URI. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` in `server/.env`; the callback URL must exactly match the URI in Google Cloud Console. If the consent screen is in testing mode, add your Google account as a test user. Keep the downloaded client-secret JSON outside the repository. Do not commit `server/.env` or put secrets in `.env.example`.

## Run locally

Open two PowerShell terminals at the repository root.

In the first terminal, start the client:

```powershell
npm.cmd --prefix client run dev
```

In the second terminal, start the server:

```powershell
npm.cmd --prefix server run dev
```

Vite prints the client URL, normally `http://localhost:5173`. The server listens on `http://localhost:3000`; its health endpoint is `/api/health`.

Use `npm.cmd` in PowerShell if the `npm` command is blocked by the local script execution policy.
