FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

COPY package.json ./

RUN pnpm install

COPY . .

RUN pnpm run build

EXPOSE 4004

CMD ["pnpm", "start"]
