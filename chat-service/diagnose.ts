import prisma from './src/config/db';

async function diagnose() {
  console.log('--- DIAGNOSIS START ---');
  
  // Find all DIRECT conversations
  const directConversations = await prisma.conversation.findMany({
    where: { type: 'DIRECT' },
    include: { participants: true }
  });

  console.log(`Total Direct Conversations: ${directConversations.length}`);

  const participantPairs = new Map<string, string[]>();

  for (const conv of directConversations) {
    const sortedUserIds = conv.participants.map(p => p.userId).sort().join(',');
    if (!participantPairs.has(sortedUserIds)) {
      participantPairs.set(sortedUserIds, []);
    }
    participantPairs.get(sortedUserIds)!.push(conv.id);
  }

  let duplicateFound = false;
  for (const [ids, convIds] of participantPairs.entries()) {
    if (convIds.length > 1) {
      duplicateFound = true;
      console.log(`Duplicate found for participants [${ids}]:`);
      console.log(`- Conversation IDs: ${convIds.join(', ')}`);
    }
  }

  if (!duplicateFound) {
    console.log('No duplicate direct conversations found in DB.');
  }

  // Check GROUPS as well (duplicates by name/participants might be a thing if logic is off)
  const groupConversations = await prisma.conversation.findMany({
    where: { type: 'GROUP' },
    include: { participants: true }
  });
  
  console.log(`Total Group Conversations: ${groupConversations.length}`);

  console.log('--- DIAGNOSIS END ---');
  process.exit(0);
}

diagnose().catch(err => {
  console.error(err);
  process.exit(1);
});
