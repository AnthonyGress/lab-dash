# Stage 1: Build the React app (Frontend)
FROM --platform=linux/amd64 node:lts-slim AS build
WORKDIR /src
ARG HOST_IP
COPY ./ ./
RUN echo VITE_HOST_IP=$HOST_IP >> .env
RUN npm install
RUN npm run build

# final server runtime
FROM nginx:alpine AS deploy
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 80
# CMD ["sh", "-c", "npx serve -s /frontend -l 2022"]
