import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Inspecting Reports ---');
  const reports = await prisma.report.findMany({
    include: {
      reporter: { select: { username: true } },
    }
  });

  console.log(`Total reports found: ${reports.length}`);
  reports.forEach((r, i) => {
    console.log(`[${i+1}] ID: ${r.id} | Target: ${r.targetType} (${r.targetId}) | Status: ${r.status} | Reporter: ${r.reporter?.username || 'Unknown'}`);
  });
  console.log('--- End of Inspection ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
