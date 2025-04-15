# Build (Backend)
FROM node:lts-slim AS backend-build
WORKDIR /usr/src/app
COPY ./backend ./
RUN npm install --omit-optional
RUN npm run build

# Build (Frontend)
FROM node:lts-slim AS frontend-build
WORKDIR /usr/src/app
# Copy root package.json for version access
COPY ./package.json ../package.json
COPY ./frontend ./
RUN npm install
ENV NODE_ENV=production
RUN npm run build

# Deploy (Backend)
FROM node:lts-slim AS backend-deploy
WORKDIR /app
ENV NODE_ENV=production
EXPOSE 2022
RUN apt-get update && apt-get install -y iputils-ping
COPY --from=backend-build /usr/src/app/dist/config ../config
COPY --from=backend-build /usr/src/app/dist/index.js ./
COPY --from=backend-build /usr/src/app/dist/package.json ./
COPY --from=frontend-build /usr/src/app/dist ./public
RUN npm i --omit-dev --omit-optional
CMD [ "node", "index.js" ]
