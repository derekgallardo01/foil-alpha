// debug-test.js - Find out exactly what's happening
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugTest() {
    try {
        console.log('🔄 Debug: Testing database connection...')
        console.log('📍 DATABASE_URL:', process.env.DATABASE_URL)

        // Test basic connection
        await prisma.$connect()
        console.log('✅ Connected to database!')

        // Try to query the database directly
        console.log('\n🔍 Testing direct database query...')

        try {
            // Test raw query to see what database we're actually connected to
            const result = await prisma.$queryRaw`SELECT DATABASE() as current_db`
            console.log('📍 Current database:', result[0].current_db)

            // Check what tables exist
            const tables = await prisma.$queryRaw`SHOW TABLES`
            console.log('📋 Tables found:', tables.length)

            if (tables.length > 0) {
                console.log('   Tables:', tables.map(t => Object.values(t)[0]).join(', '))

                // Check if users table exists
                const userTableExists = tables.some(t => Object.values(t)[0] === 'users')
                console.log('👥 Users table exists:', userTableExists)

                if (userTableExists) {
                    // Count users directly
                    const userCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM users`
                    console.log('👤 Users in database:', userCount[0].count)

                    // Get sample user
                    const sampleUser = await prisma.$queryRaw`SELECT name, email FROM users LIMIT 1`
                    if (sampleUser.length > 0) {
                        console.log('✅ Sample user:', sampleUser[0].name, '(' + sampleUser[0].email + ')')
                    }
                }

                // Check products
                const productTableExists = tables.some(t => Object.values(t)[0] === 'products')
                if (productTableExists) {
                    const productCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM products`
                    console.log('📦 Products in database:', productCount[0].count)
                }

                // Check price history
                const priceHistoryExists = tables.some(t => Object.values(t)[0] === 'pricehistory')
                if (priceHistoryExists) {
                    const priceCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM pricehistory`
                    console.log('📈 Price records:', priceCount[0].count)
                }
            }

        } catch (rawError) {
            console.log('❌ Raw query failed:', rawError.message)
        }

        // Now try Prisma models
        console.log('\n🔍 Testing Prisma models...')

        try {
            const userCount = await prisma.user.count()
            console.log('✅ Prisma users count:', userCount)

            const productCount = await prisma.product.count()
            console.log('✅ Prisma products count:', productCount)

            const priceCount = await prisma.priceHistory.count()
            console.log('✅ Prisma price history count:', priceCount)

        } catch (prismaError) {
            console.log('❌ Prisma model error:', prismaError.message)
        }

    } catch (error) {
        console.error('❌ Connection failed:', error.message)

        console.log('\n🔧 Troubleshooting:')
        console.log('1. Check your .env file DATABASE_URL')
        console.log('2. Make sure MySQL is running')
        console.log('3. Verify database name is correct')
        console.log('4. Check MySQL password')

    } finally {
        await prisma.$disconnect()
    }
}

debugTest()