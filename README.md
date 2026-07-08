# Enrobill

A decoupled application:

- **`backend/`** — Laravel 13 (PHP 8.3+) **API-only** backend. Exposes JSON endpoints under `/api/*`. No Blade frontend.
- **`frontend/`** — React 19 + **TypeScript** single-page application built with Vite, styled with **Tailwind CSS v4** and **shadcn/ui** components. Consumes the Laravel API.

## Prerequisites

- **PHP 8.3+** with Composer — plus the extensions Laravel needs (`pdo_sqlite`, `sqlite3`, `openssl`, `mbstring`, `curl`, `fileinfo`, `tokenizer`, `xml`, `ctype`, `bcmath`). Most ship with PHP; enable them in `php.ini` if disabled.
- **Node.js 20.19+ or 22+** (LTS 22 recommended) with npm — required by Vite 8.
- **Git**

The default database is **SQLite**, so no database server is required for local dev. (MySQL is optional — see the Docker section.) Email defaults to AWS SES; for local dev set `MAIL_MAILER=log` in `backend/.env` to skip AWS.

### Installing on Windows

- **PHP + Composer:** the easiest path is [Laravel Herd for Windows](https://herd.laravel.com/windows) (bundles a configured PHP and Composer). Alternatives: [XAMPP](https://www.apachefriends.org/) or the [php.net](https://windows.php.net/download) builds + [Composer](https://getcomposer.org/download/).
- **Node.js:** install the LTS `.msi` from [nodejs.org](https://nodejs.org/) (npm is included).
- **Git:** [git-scm.com](https://git-scm.com/download/win).

Alternatively, install only [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with WSL 2) and run the backend via the Docker stack below — no local PHP needed.

## First-time setup

```bash
# Backend
cd backend
composer install
cp .env.example .env          # Windows: copy .env.example .env
php artisan key:generate
php artisan migrate            # add --seed to load demo data, if seeders are present

# Frontend
cd ../frontend
npm install
```

## Running in development

Run each in its own terminal.

### 1. Backend (Laravel API) — http://localhost:8000

```bash
cd backend
php artisan serve
```

> Or run the full backend dev stack (server + queue worker + log tail + backend Vite) at once with `composer run dev`.

### 2. Frontend (React SPA) — http://localhost:5173

```bash
cd frontend
npm run dev
```

The Vite dev server proxies `/api/*` to `http://localhost:8000` (see `frontend/vite.config.ts`), so the SPA calls the API with no CORS friction during development.

## Running the backend with Docker (MySQL)

The backend ships with a Docker Compose stack (`backend/docker-compose.yml`):

| Service | Image                        | Purpose                                            |
|---------|------------------------------|----------------------------------------------------|
| `app`   | `enrobill-backend` (php:8.4) | Serves the Laravel API over HTTP on **:8000**      |
| `mysql` | mysql:8.0                    | Database (host port **3307** → 3306)               |

```bash
cd backend
docker compose up -d --build
```

On startup the `app` container waits for MySQL, then runs `php artisan migrate`
automatically. The API is available at http://localhost:8000.

The app is served by Laravel's built-in server (`php artisan serve`) — simple
and fine for development. For production, put a real web server / reverse proxy
in front at the infrastructure level.

```bash
docker compose ps                          # container status
docker compose logs -f app                 # tail app logs
docker compose exec app php artisan ...     # run artisan inside the container
docker compose down                        # stop (add -v to also wipe the DB volume)
```

The MySQL credentials (db `enrobill`, user `enrobill`, password `secret`) are
defined in `docker-compose.yml`. The `DB_*` values are injected as environment
variables, which take precedence over `.env`, so the containers use MySQL while
your local `php artisan serve` can keep using SQLite. Connect a GUI client to
MySQL on `127.0.0.1:3307`.

> **Note:** `secret` is a development password. Use real secrets (e.g. via an
> `.env` / Docker secrets) before deploying anywhere real.

## Building the frontend with Docker (production)

The frontend is a Vite SPA that builds down to static files, so its Docker image
is a **multi-stage build** (`frontend/Dockerfile`): Node builds the assets, then
`nginx:alpine` serves them. The final image contains no Node — just static files.

> For **development**, don't use Docker — run `npm run dev` on the host (faster,
> with hot reload). This image is for production builds only.

```bash
cd frontend

# Build. Default API base is "/api" (assumes your reverse proxy routes /api to
# the backend). Override for a separate API host:
docker build -t enrobill-frontend .
# docker build --build-arg VITE_API_URL=https://api.example.com/api -t enrobill-frontend .

# Run — serves the SPA on http://localhost:8080
docker run -d -p 8080:80 --name enrobill-frontend enrobill-frontend

# To rebuild & re-run later, remove the old container first:
# docker rm -f enrobill-frontend
```

The nginx config (`frontend/nginx.conf`) serves `index.html` for unknown paths
so client-side routes (e.g. `/about`) work on refresh/direct navigation, caches
hashed `/assets/*` aggressively, and never caches `index.html`.

> **Build-time API URL:** `VITE_API_URL` is inlined into the bundle at *build*
> time (a SPA is static — there's no runtime env). So each environment is a
> separate build with its own `--build-arg VITE_API_URL=...`.

## How they connect

- The frontend uses a shared axios client at `frontend/src/lib/api.ts` with `baseURL = VITE_API_URL` (default `/api`).
- In development, requests to `/api` are proxied to the backend by Vite.
- In production, set `VITE_API_URL` in `frontend/.env` to the full backend URL (e.g. `https://api.example.com/api`), and set `FRONTEND_URL` in `backend/.env` so CORS allows the SPA's origin.

## API endpoints

All routes are defined in [`backend/routes/api.php`](backend/routes/api.php) and served under `/api/*`. Grouped overview:

| Group | Auth | Examples |
|-------|------|----------|
| Health | public | `GET /health`, `GET /ping` |
| Auth & account | public / `auth:sanctum` | `POST /register`, `POST /login`, `POST /logout`, `GET /me`, `PUT /me/profile`, `PUT /me/password`, email verification |
| Student portal | `auth:sanctum` | `GET /me/bill`, `GET /me/bills`, `GET /me/enrollments`, `POST /me/bill/payments`, `GET /programs`, applications (`/applications`) |
| Admin | `auth:sanctum` (admin) | applications review, students, enrollments & sections, billing (`/admin/billing`), fees, discounts, users, terms, programs, payment channels, reports |

Auth uses **Laravel Sanctum** (token-based); the `User` model has the `HasApiTokens` trait. See `backend/routes/api.php` for the full list.

## UI (Tailwind + shadcn/ui)

The frontend uses **Tailwind CSS v4** (via `@tailwindcss/vite`) and **shadcn/ui**
(Radix-based, neutral theme, Geist font, lucide icons). Components live in
`frontend/src/components/ui/` and are owned by the project (copy-in, not a
dependency). The `@` import alias maps to `src/`.

```bash
cd frontend
# Add more components as needed:
npx shadcn@latest add dialog table form select ...
```

Config: `frontend/components.json`. Theme tokens (colors, radius, dark mode) are
defined as CSS variables in `frontend/src/index.css`.

## Frontend routes (client-side SPA)

Defined in [`frontend/src/router.ts`](frontend/src/router.ts):

| Path            | Area                                                                 |
|-----------------|----------------------------------------------------------------------|
| `/`             | Redirects to the right area based on the signed-in user's role       |
| `/login`, `/register` | Authentication                                                 |
| `/admin/*`      | Staff portal — applications, students, enrollments, sections, scheduling, billing, fees, discounts, programs, terms, users, payment methods, reports |
| `/portal/*`     | Student/applicant portal — bills, programs, applications, notifications, account |
| `*`             | 404 Not Found                                                        |
