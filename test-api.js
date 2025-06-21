// test-apis.js - Test the marketplace APIs
// Run this after starting your dev server: npm run dev

const BASE_URL = 'http://localhost:3000';

// Test functions
async function testMarketplaceAPI() {
    console.log('🧪 Testing Marketplace APIs...\n');

    try {
        // Test 1: Get marketplace listings
        console.log('1. Testing GET /api/marketplace');
        const marketplaceResponse = await fetch(`${BASE_URL}/api/marketplace`);
        const marketplaceData = await marketplaceResponse.json();
        console.log('✅ Marketplace response:', marketplaceData);

        // Test 2: Get cards (should work)
        console.log('\n2. Testing GET /api/cards');
        const cardsResponse = await fetch(`${BASE_URL}/api/cards`);
        const cardsData = await cardsResponse.json();
        console.log('✅ Cards response:', cardsData.cards?.length || 0, 'cards found');

        // Test 3: Test admin cards API
        console.log('\n3. Testing GET /api/admin/cards');
        const adminCardsResponse = await fetch(`${BASE_URL}/api/admin/cards`);
        const adminCardsData = await adminCardsResponse.json();
        console.log('✅ Admin cards response:', adminCardsData.cards?.length || 0, 'cards found');

        console.log('\n🎉 API structure tests completed!');
        console.log('💡 Next: Login as a user and test authenticated endpoints');

    } catch (error) {
        console.error('❌ API test error:', error);
    }
}

// Run the tests
testMarketplaceAPI();