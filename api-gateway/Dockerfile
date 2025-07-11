FROM node:lts-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install
RUN npm install grpc-tools grpc_tools_node_protoc_ts

COPY /src ./src

COPY generate.js ./
COPY protos/ ./protos/

RUN mkdir -p protos grpc-generated
RUN node generate.js
RUN npm run build

# RUN addgroup --system --gid 1001 nodejs
# RUN adduser --system --uid 1001 nodejs
# USER nodejs

EXPOSE 8080

CMD [ "npm","run","dev" ]