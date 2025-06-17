// test-wallet.js - Test wallet functionality
// You'll need to get a session cookie first by logging in

async function testWalletAPI() {
    console.log('💰 Testing Wallet APIs...\n');

    try {
        // Test getting wallet (requires authentication)
        console.log('1. Testing GET /api/user/wallet (requires login)');
        const walletResponse = await fetch('http://localhost:3000/api/user/wallet', {
            credentials: 'include' // Include cookies
        });

        if (walletResponse.ok) {
            const walletData = await walletResponse.json();
            console.log('✅ Wallet data:', walletData);
        } else {
            console.log('⚠️ Wallet requires authentication - status:', walletResponse.status);
        }

        // Test adding money (admin only)
        console.log('\n2. Testing POST /api/user/wallet (admin only)');
        const addMoneyResponse = await fetch('http://localhost:3000/api/user/wallet', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                user_id: 998, // Test user
                amount: 100.00,
                description: 'Test deposit'
            })
        });

        if (addMoneyResponse.ok) {
            const addMoneyData = await addMoneyResponse.json();
            console.log('✅ Add money response:', addMoneyData);
        } else {
            console.log('⚠️ Add money requires admin - status:', addMoneyResponse.status);
        }

        console.log('\n💡 To test wallets: Login as admin and user through the web interface');

    } catch (error) {
        console.error('❌ Wallet test error:', error);
    }
}

testWalletAPI();