FROM node:20-alpine3.18

# Install wget for healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# Copy package files first (for better layer caching)
COPY package*.json ./
COPY prisma ./prisma
COPY tsconfig.json ./

# Install dependencies and clean npm cache in one layer
RUN npm install && \
    npm cache clean --force && \
    rm -rf /tmp/*

# Create necessary directories
RUN mkdir -p logs

# Generate Prisma client (this is needed in the image)
RUN npx prisma generate

# Note: src is mounted as volume in docker-compose, so we don't copy it here
# This significantly reduces image size

EXPOSE 5003

