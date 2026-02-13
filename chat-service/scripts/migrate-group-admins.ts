import prisma from '../config/db';
import { GroupRole } from '@prisma/client';

/**
 * Migration: Fix groups without proper admin roles
 * 
 * This script:
 * 1. Finds all GROUP conversations with ownerId
 * 2. Checks if owner has ADMIN role
 * 3. Promotes owner to ADMIN if they don't have it
 * 4. Reports groups that were fixed
 */
async function migrateGroupAdmins() {
    console.log('🔍 Starting group admin migration...\n');

    try {
        // Find all groups with an owner
        const groups = await prisma.conversation.findMany({
            where: {
                type: 'GROUP',
                ownerId: { not: null }
            },
            include: {
                participants: true
            }
        });

        console.log(`Found ${groups.length} groups to check\n`);

        let fixedCount = 0;
        let alreadyCorrectCount = 0;

        for (const group of groups) {
            const owner = group.participants.find((p: any) => p.userId === group.ownerId);
            
            if (!owner) {
                console.log(`⚠️  Group "${group.name}" (${group.id}): Owner not in participants list`);
                continue;
            }

            if (owner.role === GroupRole.ADMIN) {
                alreadyCorrectCount++;
                console.log(`✅ Group "${group.name}" (${group.id}): Owner already has ADMIN role`);
            } else {
                // Promote owner to ADMIN
                await prisma.participant.update({
                    where: {
                        id: owner.id
                    },
                    data: {
                        role: GroupRole.ADMIN
                    }
                });

                fixedCount++;
                console.log(`🔧 FIXED: Group "${group.name}" (${group.id}): Promoted owner to ADMIN`);
            }
        }

        console.log('\n📊 Migration Summary:');
        console.log(`   Total groups checked: ${groups.length}`);
        console.log(`   Already correct: ${alreadyCorrectCount}`);
        console.log(`   Fixed: ${fixedCount}`);
        console.log('\n✅ Migration completed successfully!\n');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Run migration
migrateGroupAdmins()
    .then(() => {
        console.log('\nExiting...');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
