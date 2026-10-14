# Imagen única: compila la interfaz y sirve API + web en el puerto 3000.
FROM node:22.11.0-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
# Migra, siembra solo si la base está vacía y arranca.
CMD ["sh", "-c", "node apps/api/scripts/migrate.js && node apps/api/scripts/seed.js --if-empty && node apps/api/src/server.js"]
