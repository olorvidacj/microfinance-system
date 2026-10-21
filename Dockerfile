# Build stage
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/dist ./dist
# The server checks the database against these at start (src/db/initDb.ts).
COPY --from=build /app/database/migrations ./database/migrations
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

EXPOSE 3003
CMD ["node", "dist/server.cjs"]
