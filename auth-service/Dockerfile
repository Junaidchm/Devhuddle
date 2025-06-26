FROM node:20-alpine3.18

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
COPY tsconfig.json ./

RUN npm install

# Copy source files
COPY src ./src
COPY logs ./logs

# Generate Prisma client
RUN npx prisma generate

# Build the app
RUN npm run build

# Expose port
EXPOSE 3001

# Run migration and start app
CMD ["sh", "-c", "npx prisma migrate dev --name init && npm run dev"]