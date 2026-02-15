import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const notifications = await prisma.notificationObject.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      actors: true,
      recipients: true
    }
  });
  console.log(JSON.stringify(notifications, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
