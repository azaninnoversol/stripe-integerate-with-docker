# 1. stage: sirf package.json aur package-lock.json copy kar raha hai. yani dependencies install karna hai.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci


# 2. stage: dependencies install karte hai aur source code copy kar raha hai. aur build karte hai.
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build


# 3. stage: development environment banate hai. aur dev mode me run karte hai.
FROM node:20-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=5000
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 5000
CMD ["npm", "run", "dev"]


# 4. stage: production environment banate hai. aur production mode me run karte hai.
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=5000
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/next.config.* ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
EXPOSE 5000
CMD ["npm", "start", "--", "-p", "5000"]