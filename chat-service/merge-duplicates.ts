import prisma from './src/config/db';
import { Conversation, Participant, Message } from '@prisma/client';

async function mergeDuplicates() {
  console.log('--- MERGING DUPLICATES START ---');

  const conversations = await prisma.conversation.findMany({
    include: {
      participants: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  console.log(`Analyzing ${conversations.length} conversations...`);

  const groups = new Map<string, typeof conversations>();

  for (const conv of conversations) {
    const hash = conv.participants.map(p => p.userId).sort().join(',');
    if (!groups.has(hash)) {
      groups.set(hash, []);
    }
    groups.get(hash)!.push(conv);
  }

  for (const [hash, duplicates] of groups.entries()) {
    if (duplicates.length === 1) {
      const conv = duplicates[0];
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { participantHash: hash }
      });
      continue;
    }

    console.log(`Merging ${duplicates.length} duplicates for hash: [${hash}]`);

    // Sort by last message date desc, then by participant count, then by ID
    const sorted = duplicates.sort((a, b) => {
      const aTime = a.lastMessageAt?.getTime() || 0;
      const bTime = b.lastMessageAt?.getTime() || 0;
      if (bTime !== aTime) return bTime - aTime;
      return b.id.localeCompare(a.id);
    });

    const winner = sorted[0];
    const losers = sorted.slice(1);

    console.log(`Winner: ${winner.id}, Losers: ${losers.map(l => l.id).join(', ')}`);

    for (const loser of losers) {
      // 1. Reassign messages
      await prisma.message.updateMany({
        where: { conversationId: loser.id },
        data: { conversationId: winner.id }
      });

      // 2. Delete loser participants (winner already has them)
      await prisma.participant.deleteMany({
        where: { conversationId: loser.id }
      });

      // 3. Delete the loser conversation
      await prisma.conversation.delete({
        where: { id: loser.id }
      });
    }

    // Update winner with hash
    await prisma.conversation.update({
      where: { id: winner.id },
      data: { participantHash: hash }
    });
  }

  console.log('--- MERGING DUPLICATES END ---');
  process.exit(0);
}

mergeDuplicates().catch(err => {
  console.error(err);
  process.exit(1);
});
