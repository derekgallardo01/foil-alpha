// import { PrismaClient } from '@prisma/client'

// const prisma = new PrismaClient()

// async function testConnection() {
//     try {
//         console.log('🔄 Testing database connection...')

//         // Test basic connection
//         await prisma.$connect()
//         console.log('✅ Database connected successfully!')

//         // Test table existence by counting records
//         const userCount = await prisma.user.count()
//         const productCount = await prisma.product.count()
//         const priceHistoryCount = await prisma.priceHistory.count()

//         console.log('\n📊 Current database status:')
//         console.log(`   Users: ${userCount}`)
//         console.log(`   Products: ${productCount}`)
//         console.log(`   Price History Records: ${priceHistoryCount}`)

//         // Test table creation by trying to find all tables
//         console.log('\n🗄️  Testing table access...')

//         const tables = [
//             'users', 'products', 'price_history', 'watchlist',
//             'price_alerts', 'notifications', 'activity_logs',
//             'accounts', 'sessions', 'verificationtokens'
//         ]

//         for (const table of tables) {
//             try {
//                 switch (table) {
//                     case 'users':
//                         await prisma.user.findMany({ take: 1 })
//                         break
//                     case 'products':
//                         await prisma.product.findMany({ take: 1 })
//                         break
//                     case 'price_history':
//                         await prisma.priceHistory.findMany({ take: 1 })
//                         break
//                     case 'watchlist':
//                         await prisma.watchlist.findMany({ take: 1 })
//                         break
//                     case 'price_alerts':
//                         await prisma.priceAlert.findMany({ take: 1 })
//                         break
//                     case 'notifications':
//                         await prisma.notification.findMany({ take: 1 })
//                         break
//                     case 'activity_logs':
//                         await prisma.activityLog.findMany({ take: 1 })
//                         break
//                     case 'accounts':
//                         await prisma.account.findMany({ take: 1 })
//                         break
//                     case 'sessions':
//                         await prisma.session.findMany({ take: 1 })
//                         break
//                     case 'verificationtokens':
//                         await prisma.verificationToken.findMany({ take: 1 })
//                         break
//                 }
//                 console.log(`   ✅ ${table} - OK`)
//             } catch (error) {
//                 console.log(`   ❌ ${table} - Error:`, error.message)
//             }
//         }

//         console.log('\n🎉 Database setup complete!')
//         console.log('\n📝 Next steps:')
//         console.log('   1. Start your development server: npm run dev')
//         console.log('   2. Visit http://localhost:3000')
//         console.log('   3. Test user registration/login')
//         console.log('   4. Add sample product data')

//     } catch (error) {
//         console.error('❌ Database connection failed:')
//         console.error('Error details:', error.message)
//         console.error('\n🔧 Troubleshooting:')
//         console.error('   1. Check if MySQL is running')
//         console.error('   2. Verify DATABASE_URL in .env file')
//         console.error('   3. Ensure tcg_market database exists')
//         console.error('   4. Check root password is correct')
//     } finally {
//         await prisma.$disconnect()
//     }
// }

// testConnection()

// test.js - Simple test to check if everything works
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function simpleTest() {
    try {
        console.log('🔄 Testing database connection...')

        // Test basic connection
        await prisma.$connect()
        console.log('✅ Connected to database!')

        // Count your existing data
        const userCount = await prisma.user.count()
        const productCount = await prisma.product.count()
        const priceCount = await prisma.priceHistory.count()

        console.log(`\n📊 Your Data:`)
        console.log(`  Users: ${userCount}`)
        console.log(`  Products: ${productCount}`)
        console.log(`  Price Records: ${priceCount}`)

        if (userCount > 0) {
            const user = await prisma.user.findFirst()
            console.log(`  ✅ Sample user: ${user.name} (${user.email})`)
        }

        if (productCount > 0) {
            const product = await prisma.product.findFirst()
            console.log(`  ✅ Sample product: ${product.title}`)
        }

        console.log('\n🎉 Everything is working! Ready to fix APIs.')

    } catch (error) {
        console.error('❌ Error:', error.message)

        if (error.message.includes('Unknown database')) {
            console.log('\n💡 Fix: Check database name in .env file')
        }

        if (error.message.includes('Access denied')) {
            console.log('\n💡 Fix: Check MySQL password in .env file')
        }

    } finally {
        await prisma.$disconnect()
    }
}

simpleTest()