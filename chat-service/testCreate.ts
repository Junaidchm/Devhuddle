import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const user1 = '80922465-c281-4331-b931-7932da62c316';
  const user2 = 'a4118fa9-ff15-461b-873a-0c1404fd5dbb'; // Let's say user2
  const hash = [user1, user2].sort().join(',');
  console.log("Hash:", hash);
  const conv = await prisma.conversation.findUnique({
      where: { participantHash: hash },
      include: { participants: true }
  });
  console.log("Conv:", !!conv, conv?.id);
}
main().catch(console.error).finally(()=>prisma.$disconnect());
