# Stage 1: Build the React app (Frontend)
FROM --platform=linux/amd64 node:lts-slim AS build
WORKDIR /
COPY ./ ./
RUN npm install
RUN npm run build

# final server runtime
FROM nginx:alpine AS deploy
ENV HOST_IP=$HOST_IP
COPY --from=build /dist /usr/share/nginx/html
COPY --from=build /src/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Start Nginx with the environment injection script
CMD ["/entrypoint.sh"]
EXPOSE 80
