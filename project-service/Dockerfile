FROM node:20-alpine3.18

# Install protoc for ts-proto
RUN apk add --no-cache protoc protobuf-dev

WORKDIR /app

COPY prisma ./prisma
COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

# Copy other files
COPY protos ./protos
COPY logs ./logs

# Generate Prisma client
RUN npx prisma generate

EXPOSE 3004
EXPOSE 50053

