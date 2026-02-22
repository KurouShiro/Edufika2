FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json ./
COPY src ./src

RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8091

COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node package*.json ./

EXPOSE 8091

USER node

CMD ["sh", "-c", "node dist/db/runMigrations.js && node dist/server.js"]
