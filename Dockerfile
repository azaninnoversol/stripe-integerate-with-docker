# 
# Multi-stage Dockerfile (optimized).
# Targets:
# - `dev`   : local development with `next dev`
# - default (runner): production `next start`
#

# Alpine Linux 
# Alpine Linux ek lightweight Linux distribution hai jo security aur performance ke liye banayi gayi hai.
# Ye Docker images ke liye popular choice hai kyunki ye chhoti aur fast hai.

# Ye base image le raha hai Node.js 20 ke sath, Alpine Linux par (lightweight env), aur is stage ko "deps" name de raha hai
FROM node:20-alpine AS deps

# Kaam karne ki directory bana raha hai image ke andar /app nam se
WORKDIR /app

# Dono package files (dependencies ki list) ko host se container mai le aaraha hai
COPY package*.json ./

# Saari dependencies install kar raha hai (npm ci zyada reliable hota hai CI/CD aur prod builds ke liye)
RUN npm ci

# Ab ek naya stage start kar raha hai "builder" naam ka, phir se base image wahi use ho rahi hai
FROM node:20-alpine AS builder

# Work directory fir se /app set ho rahi hai
WORKDIR /app

# Pehle stage ("deps") se node_modules la raha hai taake dependencies repeat na ho
COPY --from=deps /app/node_modules ./node_modules

# Baaki saara project code container me copy kar raha hai
COPY . .

# Next.js app ko build kar raha hai (output .next folder me aayega)
RUN npm run build

# Ye stage sirf development (local dev mode) ke liye banayi gayi hai
FROM node:20-alpine AS dev

# Work directory set kar raha hai
WORKDIR /app

# Kuch environment variables set kar raha hai development ke liye
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=5000

# Dependencies deps stage se copy kar raha hai
COPY --from=deps /app/node_modules ./node_modules

# Source code bhi copy kar raha hai
COPY . .

# Port 5000 expose kar raha hai (docker se bahar access mile iss port per)
EXPOSE 5000

# Default command run kar raha hai: next dev mode
CMD ["npm", "run", "dev"]

# Ye production (runner) ke liye hai, yahan se production ready image banegi
FROM node:20-alpine AS runner

# Work directory set kar raha hai
WORKDIR /app

# Prod env vars set kar raha hai
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=5000

# Sirf package files copy kar raha hai, taake prod deps install ho sakein
COPY package*.json ./

# Sirf production dependencies install hoengi (dev wali nahi)
RUN npm ci --omit=dev

# Next.js runtime ko config chahiye hoti hai sahi se start hone ke liye, woh copy kar raha hai
COPY --from=builder /app/next.config.* ./

# Build output (.next) aur static files (public) production ke liye copy kar raha hai
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Port expose kar raha hai
EXPOSE 5000

# Start command prod ke liye (npm start) aur port set kar raha hai
CMD ["npm", "start", "--", "-p", "5000"]