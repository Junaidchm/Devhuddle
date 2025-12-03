#!/bin/bash

echo "🚀 Setting up project-service for local development..."
echo ""

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Error: Node.js 18+ required. Current version: $(node -v)"
  exit 1
fi
echo "✅ Node.js version: $(node -v)"

# Remove old lock file and node_modules if they exist
if [ -f "package-lock.json" ]; then
  echo "🗑️  Removing old package-lock.json..."
  rm package-lock.json
fi

if [ -d "node_modules" ]; then
  echo "🗑️  Removing old node_modules..."
  rm -rf node_modules
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Verify Prisma version
PRISMA_VERSION=$(npm list prisma --depth=0 2>/dev/null | grep prisma | awk '{print $2}' | cut -d'@' -f2)
echo "✅ Prisma version: $PRISMA_VERSION"

# Generate Prisma client
echo ""
echo "🔧 Generating Prisma client..."
npx prisma generate

# Generate gRPC code
echo ""
echo "🔧 Generating gRPC code..."
if [ -f "src/generate.ts" ]; then
  npx ts-node src/generate.ts
else
  echo "⚠️  Warning: src/generate.ts not found, skipping gRPC generation"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Create .env file with required environment variables"
echo "2. Setup database: npx prisma migrate dev"
echo "3. Start service: npm run dev"
echo ""

