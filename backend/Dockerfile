# Build (Backend)
FROM --platform=linux/amd64 node:lts-slim AS backend-build
WORKDIR /usr/src/app
COPY ./backend ./
RUN npm install --omit-optional
RUN npm run build

# Deploy (Backend)
FROM --platform=linux/amd64 node:lts-slim AS backend-deploy
WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV NODE_ENV=production
EXPOSE 5000
COPY --from=backend-build /usr/src/app/dist ./
RUN npm i --omit-dev --omit-optional
CMD [ "node", "index.js" ]
