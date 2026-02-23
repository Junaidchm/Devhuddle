import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const c = await prisma.conversation.findMany({ include: { participants: true }});
  console.dir(c, { depth: null });
  const p = await prisma.participant.findMany();
  console.dir(p, { depth: null });
}
run();
