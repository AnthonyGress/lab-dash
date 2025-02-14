# Build the React app (Frontend)
FROM --platform=linux/amd64 node:lts-slim AS frontend-build
WORKDIR /usr/src/app
COPY ./frontend ./
RUN npm install
RUN npm run build:dev


# Deploy (Frontend)
FROM nginx:alpine AS frontend-deploy
COPY --from=frontend-build /usr/src/app/dist /usr/share/nginx/html
EXPOSE 80
# RUN npm i --omit-dev
CMD ["nginx", "-g", "daemon off;"]

