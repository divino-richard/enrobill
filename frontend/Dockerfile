# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 — build the static assets with Node.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# The API base URL is inlined into the bundle at BUILD time (Vite replaces
# import.meta.env.VITE_* with literal values). Override it per environment:
#   docker build --build-arg VITE_API_URL=https://api.example.com/api -t enrobill-frontend .
# Default "/api" assumes your reverse proxy routes /api to the backend.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

# Install dependencies first (better layer caching).
COPY package*.json ./
RUN npm ci

# Build.
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2 — serve the static output with nginx. No Node in the final image.
# ---------------------------------------------------------------------------
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
