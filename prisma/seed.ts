import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Update all existing waitlist entries to SUBSCRIBED status
  await prisma.waitlist.updateMany({
    where: {},
    data: {
      status: 'SUBSCRIBED'
    }
  });

  console.log('Updated all waitlist entries to SUBSCRIBED status');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
