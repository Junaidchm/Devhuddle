const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.message.deleteMany({
    where: { type: 'SYSTEM' }
  });
  console.log(`Deleted ${result.count} SYSTEM messages`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
