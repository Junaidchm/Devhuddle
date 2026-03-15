FROM node:20-slim
WORKDIR /app
COPY api-gateway/package*.json ./
RUN npm install --no-audit --no-fund
