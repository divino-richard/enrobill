# Enrobill

A decoupled application:

- **`backend/`** — Laravel 13 (PHP 8.5) **API-only** backend. Exposes JSON endpoints under `/api/*`. No Blade frontend.
- **`frontend/`** — React 19 single-page application built with Vite. Consumes the Laravel API.

## Prerequisites

- PHP 8.5+ and Composer
- Node.js 22+ and npm

## Running in development

Run each in its own terminal.

### 1. Backend (Laravel API) — http://localhost:8000

```bash
cd backend
php artisan serve
```

### 2. Frontend (React SPA) — http://localhost:5173

```bash
cd frontend
npm run dev
```

The Vite dev server proxies `/api/*` to `http://localhost:8000` (see `frontend/vite.config.js`), so the SPA calls the API with no CORS friction during development.

## Running the backend with Docker (MySQL)

The backend ships with a Docker Compose stack (`backend/docker-compose.yml`):

| Service | Image          | Purpose                                            |
|---------|----------------|----------------------------------------------------|
| `app`   | php:8.4        | Serves the Laravel API over HTTP on **:8000**      |
| `mysql` | mysql:8.0      | Database (host port **3307** → 3306)               |

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

- The frontend uses a shared axios client at `frontend/src/lib/api.js` with `baseURL = VITE_API_URL` (default `/api`).
- In development, requests to `/api` are proxied to the backend by Vite.
- In production, set `VITE_API_URL` in `frontend/.env` to the full backend URL (e.g. `https://api.example.com/api`), and set `FRONTEND_URL` in `backend/.env` so CORS allows the SPA's origin.

## API endpoints

| Method | Path          | Auth          | Description                |
|--------|---------------|---------------|----------------------------|
| GET    | `/api/health` | public        | Service health check       |
| GET    | `/api/ping`   | public        | Returns `{ "message": "pong" }` |
| GET    | `/api/user`   | `auth:sanctum`| The authenticated user     |

Auth is scaffolded with **Laravel Sanctum** (token-based). The `User` model uses the `HasApiTokens` trait, ready for issuing API tokens.

## Frontend routes (client-side SPA)

| Path     | Page        |
|----------|-------------|
| `/`      | Home (calls `/api/health`) |
| `/about` | About       |
| `*`      | 404 Not Found |
