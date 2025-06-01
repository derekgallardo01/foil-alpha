import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearWaitlist() {
  try {
    console.log('Starting waitlist cleanup...');
    
    // Get count of entries before deletion
    const countBefore = await prisma.waitlist.count();
    console.log(`Found ${countBefore} waitlist entries to delete`);

    // Delete all waitlist entries
    await prisma.waitlist.deleteMany();
    
    // Verify deletion
    const countAfter = await prisma.waitlist.count();
    console.log(`Successfully deleted ${countBefore} waitlist entries`);
    console.log(`Remaining entries: ${countAfter}`);

    // Close the database connection
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error clearing waitlist:', error);
    process.exit(1);
  }
}

// Run the cleanup function
void clearWaitlist();
