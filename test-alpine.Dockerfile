FROM node:20-alpine3.18
WORKDIR /app
COPY api-gateway/package*.json ./
RUN npm install --no-audit --no-fund
