FROM node:20-alpine3.18

# Install protoc for ts-proto
RUN apk add --no-cache protoc

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
COPY tsconfig.json ./

RUN npm install

# Copy source files
# COPY generate.ts ./
COPY protos/ ./protos/
COPY src ./src
COPY logs ./logs

# Generate Prisma client
RUN npx prisma generate

# RUN npx ts-node generate.ts
# Build the app
RUN npm run build

# Expose port
EXPOSE 3001

# Run migration and start app
CMD ["sh", "-c","npm run dev"]