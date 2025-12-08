FROM node:lts-alpine

WORKDIR /app

# Copy package files first (for better layer caching)
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies and clean npm cache in one layer
RUN npm install && \
    npm cache clean --force && \
    rm -rf /tmp/*

# Create necessary directories
RUN mkdir -p logs

# Note: src is mounted as volume in docker-compose, so we don't copy it here
# This significantly reduces image size

EXPOSE 3002

CMD ["npm", "run", "dev"]
