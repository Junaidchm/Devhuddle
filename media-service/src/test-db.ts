import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projectId = 'cmlp8ok370000nw4fe20ljck7';
  const mediaId = '020156f5-d8fa-4502-a78d-3a952c2a23f2';

  const updatedMedia = await prisma.media.update({
    where: { id: mediaId },
    data: {
      projectId: projectId,
      mediaType: 'PROJECT_IMAGE'
    }
  });

  console.log('Updated Media:', updatedMedia);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
