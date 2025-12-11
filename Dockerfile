# STAGE 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy root package.json to parent directory (/app/package.json)
# This allows vite.config.ts to resolve the root version from "../package.json"
COPY package.json /app/package.json

# Copy frontend dependency files
COPY frontend/package*.json ./
RUN npm ci

# Copy source code and build
COPY frontend/ .
RUN npm run build

# STAGE 2: Build Backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .
RUN npm run build
# Prune development dependencies to reduce final image size
RUN npm prune --production

# STAGE 3: Final Runtime Image
FROM node:20-alpine
WORKDIR /app

# Install curl (optional, for healthchecks)
RUN apk add --no-cache curl

# Copy built backend (esbuild output)
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/package.json ./
COPY --from=backend-builder /app/backend/node_modules ./node_modules

# Copy built frontend assets
# Place them in ./dist/public so the Express backend can serve them correctly
COPY --from=frontend-builder /app/frontend/dist ./dist/public

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "dist/index.js"]