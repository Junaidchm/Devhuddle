FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

COPY package.json ./

RUN pnpm install

# Copy Prisma schema and generate client
COPY prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate
    
COPY . .
    
RUN pnpm run build

EXPOSE 4004

CMD ["pnpm", "start"]
