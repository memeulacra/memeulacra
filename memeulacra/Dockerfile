FROM node:22-bullseye-slim AS builder
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production image
FROM node:22-bullseye-slim AS runner
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
EXPOSE 3005
ENV PORT=3005
ENV NODE_ENV=production
CMD ["npm", "run", "start"]
