# Imagine de producție pentru Median (VPS / Docker / Railway / Render / Fly.io).
# Pe un server permanent, colectarea automată rulează la fiecare 5 minute
# direct din proces (vezi instrumentation.ts).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 MEDIAN_DATA_DIR=/data
COPY --from=build /app ./
RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME /data
EXPOSE 3000
CMD ["npm", "start"]
