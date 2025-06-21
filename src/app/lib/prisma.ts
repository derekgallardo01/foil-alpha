// src/lib/prisma.ts
// import { PrismaClient } from "@prisma/client";

// const prisma = new PrismaClient();
// export { prisma };
// src/app/lib/prisma.ts - Create this file if it doesn't exist
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma