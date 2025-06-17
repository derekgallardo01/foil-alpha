// test-prisma.ts - Create this file in your project ROOT directory
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testPrismaConnection() {
    try {
        console.log('🔗 Testing Prisma connection...')

        // Test existing tables
        const userCount = await prisma.user.count()
        console.log(`✅ Users table: ${userCount} users found`)

        const cardCount = await prisma.card.count()
        console.log(`✅ Cards table: ${cardCount} cards found`)

        // Test new wallet tables - these should work now!
        const walletCount = await prisma.userWallet.count()
        console.log(`✅ User wallets table: ${walletCount} wallets found`)

        const walletTransactionCount = await prisma.walletTransaction.count()
        console.log(`✅ Wallet transactions table: ${walletTransactionCount} transactions found`)

        const transactionCount = await prisma.transaction.count()
        console.log(`✅ Transactions table: ${transactionCount} transactions found`)

        console.log('🎉 All tables connected successfully!')
        console.log('✨ Phase 1 Complete - Database schema is ready!')

    } catch (error) {
        console.error('❌ Prisma connection error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

// Run the test
testPrismaConnection()