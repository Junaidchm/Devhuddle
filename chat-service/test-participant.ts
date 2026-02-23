import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const p = await prisma.participant.findMany({ where: { conversationId: "cmlrpnp9w0000qpnzjo7jw97w" }});
  console.log("Participants:", p);
}
run();
