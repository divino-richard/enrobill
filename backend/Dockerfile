# PHP-FPM image for the Enrobill Laravel API.
FROM php:8.4-fpm

# System dependencies needed to build the PHP extensions below.
RUN apt-get update && apt-get install -y \
    git \
    curl \
    zip \
    unzip \
    libzip-dev \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    && rm -rf /var/lib/apt/lists/*

# PHP extensions required by Laravel + MySQL.
RUN docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd zip

# Composer (copied from the official Composer image).
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copy the application and install dependencies. At runtime the source is also
# bind-mounted (see docker-compose.yml), so this gives a working standalone
# image while local edits are still picked up live during development.
COPY . .
RUN composer install --no-interaction --prefer-dist --optimize-autoloader --no-scripts \
    && chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

# Entrypoint waits for MySQL and runs migrations before starting php-fpm.
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["entrypoint.sh"]
CMD ["php-fpm"]
