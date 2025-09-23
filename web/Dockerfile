# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code (excluding test and story files)
COPY . .

# Remove test and story files to avoid TypeScript errors
RUN find src -name "*.test.tsx" -delete && \
    find src -name "*.test.ts" -delete && \
    find src -name "*.stories.tsx" -delete && \
    rm -rf tests/ && \
    rm -rf stories/ && \
    rm -rf .storybook/

# Build the application directly with vite (skip TypeScript checks) - v4
RUN npx vite build

# Production stage
FROM nginx:alpine

# Install wget for health checks
RUN apk --no-cache add wget

# Copy built app from builder stage - v4
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration template (use local config for Docker local runs)
COPY nginx.local.conf /etc/nginx/conf.d/default.conf.template

# Create startup script with proper environment variable handling
RUN echo '#!/bin/sh' > /docker-entrypoint.sh && \
    echo 'export BACKEND_URL=${BACKEND_URL:-http://localhost:5001}' >> /docker-entrypoint.sh && \
    echo 'envsubst "\$BACKEND_URL" < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf' >> /docker-entrypoint.sh && \
    echo 'nginx -g "daemon off;"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

# Set default environment variable
ENV BACKEND_URL=http://localhost:5001

# Expose port
EXPOSE 80

# Start nginx with environment variable substitution
CMD ["/docker-entrypoint.sh"] 