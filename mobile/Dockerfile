# -- Stage 1: Build Flutter Web ---------------------------------------------
FROM ghcr.io/cirruslabs/flutter:3.24.3 AS builder

WORKDIR /app

# Copy dependency files first (layer caching)
COPY pubspec.yaml pubspec.lock ./

# Get dependencies
RUN flutter pub get

# Copy the rest of the source code
COPY . .

# Build Flutter web release
# API_BASE_URL is baked in at build time via --dart-define
ARG API_BASE_URL=https://backend-production-343b4.up.railway.app/api
RUN flutter build web --release \
    --dart-define=API_BASE_URL=${API_BASE_URL}

# -- Stage 2: Serve with nginx ----------------------------------------------
FROM nginx:alpine

# Copy built web files from builder stage
COPY --from=builder /app/build/web /usr/share/nginx/html

# Custom nginx config to handle Flutter routing (SPA support)
RUN echo 'server { listen 8080; root /usr/share/nginx/html; index index.html; location / { try_files $uri $uri/ /index.html; } gzip on; gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript; }' > /etc/nginx/conf.d/default.conf

# Railway uses port 8080
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
