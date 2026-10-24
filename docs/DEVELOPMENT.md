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

Copy the example environment file when you want to override the default port:

```powershell
Copy-Item server/.env.example server/.env
```

The example sets `PORT=3000`. The server defaults to port 3000 if you skip this step. Do not commit `server/.env` or put secrets in `.env.example`.

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
