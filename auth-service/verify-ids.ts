import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const idsToCheck = [
  "5f800ea3-8856-4f00-b952-24f9972cf2b0",
  "80922465-c281-4331-b931-7932da62c316",
  "8d69bb61-2032-4c8a-9ac8-bcf11903694f",
  "9d0fb659-680b-4e23-a42d-10e19351511b",
  "3a8afeb4-0920-4720-9051-2c25100a320a",
  "2cb9942f-c374-481a-b782-b0de39a33882"
];

async function main() {
  const users = await prisma.user.findMany({
    where: {
      id: { in: idsToCheck }
    },
    select: {
      id: true,
      name: true,
      username: true,
    }
  });
  console.log("Found users:");
  console.log(JSON.stringify(users, null, 2));
  
  const foundIds = users.map(u => u.id);
  const missingIds = idsToCheck.filter(id => !foundIds.includes(id));
  console.log("Missing IDs:");
  console.log(JSON.stringify(missingIds, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
