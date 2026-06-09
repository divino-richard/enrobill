#!/bin/sh
set -e

cd /var/www/html

# Install PHP dependencies if they're missing (e.g. a fresh clone).
if [ ! -d vendor ]; then
    echo "Installing composer dependencies..."
    composer install --no-interaction --prefer-dist --optimize-autoloader
fi

# Generate an app key if one isn't set yet.
if ! grep -q "^APP_KEY=base64" .env 2>/dev/null; then
    php artisan key:generate --force || true
fi

# Wait for MySQL to accept connections before continuing.
echo "Waiting for MySQL at ${DB_HOST}:${DB_PORT}..."
until php -r "new PDO('mysql:host=${DB_HOST};port=${DB_PORT}', '${DB_USERNAME}', '${DB_PASSWORD}');" >/dev/null 2>&1; do
    sleep 2
done
echo "MySQL is ready."

# Run migrations.
php artisan migrate --force

# Make sure runtime directories are writable.
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true

exec "$@"
