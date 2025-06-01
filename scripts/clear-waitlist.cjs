const { PrismaClient } = require("@prisma/client");
const dotenv = require("dotenv");

dotenv.config();

const prisma = new PrismaClient();

async function clearWaitlist() {
    console.log("\nStarting waitlist cleanup...");
    
    try {
        // Get count before deletion
        const count = await prisma.waitlist.count();
        console.log(`Found ${count} waitlist entries to delete`);

        // Delete all waitlist entries
        await prisma.waitlist.deleteMany();
        console.log(`Successfully deleted ${count} waitlist entries`);

        // Verify deletion
        const remaining = await prisma.waitlist.count();
        console.log(`Remaining waitlist entries: ${remaining}`);
    } catch (error) {
        console.error("Error clearing waitlist:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the cleanup
clearWaitlist();
