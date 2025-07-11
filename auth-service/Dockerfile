FROM node:20-alpine3.18

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
COPY tsconfig.json ./

RUN npm install
RUN npm install grpc-tools grpc_tools_node_protoc_ts

# Copy source files
COPY generate.js ./
COPY protos/ ./protos/
COPY src ./src
COPY logs ./logs

# Generate Prisma client
RUN npx prisma generate

RUN mkdir -p protos grpc-generated
RUN node generate.js
# Build the app
RUN npm run build

# Expose port
EXPOSE 3001

# Run migration and start app
CMD ["sh", "-c", "npx prisma migrate dev --name init && npm run dev"]