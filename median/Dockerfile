# Imagine unică pentru Median: același cod rulează ca site (web) și ca worker (colectare + AI + imagini).
# Construită pe Debian (glibc) ca modulele native better-sqlite3 și sharp să folosească binarele precompilate.
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 MEDIAN_DATA_DIR=/data
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tini && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data && chown node:node /data
COPY --from=build --chown=node:node /app ./
USER node
VOLUME /data
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
# Implicit pornește site-ul; serviciul „worker” din docker-compose suprascrie comanda.
CMD ["npm", "start"]
