# Stage 1: Build the React app (Frontend)
FROM --platform=linux/amd64 node:20 AS frontend-build
WORKDIR /src
COPY ./ ./
RUN npm install
RUN npm run build

# final server runtime
FROM --platform=linux/amd64 node:20 AS final
WORKDIR /frontend
COPY --from=frontend-build /src/dist /frontend
EXPOSE 2022
CMD ["sh", "-c", "npx serve -s /frontend -l 2022"]
