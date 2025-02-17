# Build the React app (Frontend)
FROM --platform=linux/amd64 node:lts-slim AS frontend-build
ENV VITE_API_URL=http://host.docker.internal:5000
WORKDIR /usr/src/app
COPY ./ ./
RUN npm install
RUN npm run build:dev
# RUN echo >> VITE_API_URL=$VITE_API_URL .env


# Deploy (Frontend)
FROM nginx:alpine AS frontend-deploy
COPY --from=frontend-build /usr/src/app/dist /usr/share/nginx/html
EXPOSE 80
# RUN npm i --omit-dev
CMD ["nginx", "-g", "daemon off;"]

