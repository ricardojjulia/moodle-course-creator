FROM php:8.3-apache

RUN apt-get update && apt-get install -y \
    libzip-dev libpng-dev libjpeg-dev libwebp-dev \
    libxml2-dev libicu-dev libxslt-dev \
    ghostscript unzip curl \
  && docker-php-ext-configure gd --with-jpeg --with-webp \
  && docker-php-ext-install -j$(nproc) \
    gd zip intl xml soap xsl \
    pdo pdo_mysql mysqli opcache exif \
  && a2enmod rewrite \
  && rm -rf /var/lib/apt/lists/*

COPY moodle.ini /usr/local/etc/php/conf.d/moodle.ini

# Download Moodle 5.1.2 from GitHub releases
RUN curl -fsSL "https://github.com/moodle/moodle/archive/refs/tags/v5.1.2.tar.gz" \
    | tar xz -C /var/www/html --strip-components=1 \
  && chown -R www-data:www-data /var/www/html

# moodledata lives outside the webroot
RUN mkdir -p /var/moodledata && chown www-data:www-data /var/moodledata

# Moodle 5.1 moved public files to public/ subdirectory
RUN sed -i 's|DocumentRoot /var/www/html|DocumentRoot /var/www/html/public|g' \
      /etc/apache2/sites-available/000-default.conf \
  && sed -i 's|<Directory /var/www/html>|<Directory /var/www/html/public>|g' \
      /etc/apache2/apache2.conf \
  && echo '<Directory /var/www/html/public>\n\tAllowOverride All\n\tRequire all granted\n</Directory>' \
      >> /etc/apache2/apache2.conf

EXPOSE 80
