FROM node:lts-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
RUN npm install

COPY /src ./src

RUN npm run build

# RUN addgroup --system --gid 1001 nodejs
# RUN adduser --system --uid 1001 nodejs
# USER nodejs

EXPOSE 3002

CMD [ "npm","run","dev" ]