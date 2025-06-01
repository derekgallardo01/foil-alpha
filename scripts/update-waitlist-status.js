const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateWaitlistStatus() {
  try {
    // Get all waitlist entries
    const entries = await prisma.waitlist.findMany();
    console.log(`Found ${entries.length} waitlist entries`);

    // Update all entries to SUBSCRIBED status
    await prisma.waitlist.updateMany({
      where: {},
      data: {
        status: 'SUBSCRIBED'
      }
    });

    console.log('All waitlist entries have been updated to SUBSCRIBED status');
  } catch (error) {
    console.error('Error updating waitlist status:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateWaitlistStatus();
