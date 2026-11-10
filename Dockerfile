FROM node:26-bookworm-slim AS backend-dependencies
WORKDIR /app/apps/backend
COPY apps/backend/package.json apps/backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Alvo utilizável enquanto Millena Kelly prepara o projeto React.
FROM node:26-bookworm-slim AS backend
ENV NODE_ENV=production
ENV API_PORT=3000
WORKDIR /app/apps/backend
COPY --from=backend-dependencies /app/apps/backend/node_modules ./node_modules
COPY --chown=node:node apps/backend/ ./
COPY --chown=node:node docs/dados-demonstracao.json /app/docs/dados-demonstracao.json
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=6s --start-period=20s --retries=3 \
  CMD node --input-type=module -e "try { const r = await fetch('http://127.0.0.1:' + (process.env.API_PORT || 3000) + '/api/health', { signal: AbortSignal.timeout(5000) }); process.exit(r.ok ? 0 : 1); } catch { process.exit(1); }"
CMD ["npm", "start"]

FROM node:26-bookworm-slim AS frontend-build
WORKDIR /app/apps/frontend
COPY apps/frontend/package.json apps/frontend/package-lock.json ./
RUN npm ci
COPY apps/frontend/ ./
RUN npm run build

# Alvo final, disponível após a entrega do React com saída dist/.
FROM backend AS production
COPY --from=frontend-build --chown=node:node /app/apps/frontend/dist/ ./public/
