import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Starting database backup...');
    
    // Get current timestamp for backup filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `backups/waitlist-backup-${timestamp}.json`;
    
    // Query all waitlist entries
    const waitlistEntries = await prisma.waitlist.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        created_at: true,
        source: true,
        metadata: true
      }
    });

    // Write to backup file
    await import('fs/promises').then(fs => 
      fs.writeFile(backupFile, JSON.stringify(waitlistEntries, null, 2))
    );

    console.log(`Backup completed successfully. Saved to: ${backupFile}`);
    console.log(`Total entries backed up: ${waitlistEntries.length}`);

  } catch (error) {
    console.error('Error during database backup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
