FROM node:lts-alpine

# Install protoc for ts-proto
# RUN apk add --no-cache protoc
RUN apk add --no-cache protoc protobuf-dev

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
RUN npm install
RUN npm install ts-proto ts-node

COPY /src ./src

COPY /src/generate.ts ./
COPY protos/ ./protos/

# RUN npx ts-node generate.ts
RUN npm run build

# RUN addgroup --system --gid 1001 nodejs
# RUN adduser --system --uid 1001 nodejs
# USER nodejs

EXPOSE 3002

CMD [ "npm","run","dev" ]