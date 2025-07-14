FROM node:lts-alpine

# Install protoc for ts-proto
RUN apk add --no-cache protoc

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install
RUN npm install ts-proto ts-node

COPY /src ./src

COPY generate.ts ./
COPY protos/ ./protos/

RUN npx ts-node generate.ts
RUN npm run build

# RUN addgroup --system --gid 1001 nodejs
# RUN adduser --system --uid 1001 nodejs
# USER nodejs

EXPOSE 8080

CMD [ "npm","run","dev" ]