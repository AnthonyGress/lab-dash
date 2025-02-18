# Build (Backend)
FROM --platform=linux/amd64 node:lts-slim AS backend-build
WORKDIR /usr/src/app
COPY ./backend ./
RUN npm install --omit-optional
RUN npm run build

# Build (Frontend)
FROM --platform=linux/amd64 node:lts-slim AS frontend-build
WORKDIR /usr/src/app
COPY ./frontend ./
RUN npm install
ENV NODE_ENV=production
RUN npm run build

# Deploy (Backend)
FROM --platform=linux/amd64 node:lts-slim AS backend-deploy
WORKDIR /app
ENV NODE_ENV=production
EXPOSE 2022
COPY --from=backend-build /usr/src/app/dist/config ../config
COPY --from=backend-build /usr/src/app/dist/index.js ./
COPY --from=backend-build /usr/src/app/dist/package.json ./
COPY --from=frontend-build /usr/src/app/dist ./public
RUN npm i --omit-dev --omit-optional
CMD [ "node", "index.js" ]
