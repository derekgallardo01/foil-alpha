// src/app/api/test/google-chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { testGoogleChat } from '../../../lib/google-chat';
import { testUnifiedNotification } from '../../../lib/unified-notification';

// GET endpoint - No auth required for testing
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const testType = searchParams.get('type') || 'basic';

        if (testType === 'basic') {
            // Test basic Google Chat connection
            const result = await testGoogleChat();
            return NextResponse.json(result);
        } else if (testType === 'unified') {
            // Test the entire unified notification system
            // Use a test user ID (1 for example)
            const testUserId = 1;

            const result = await testUnifiedNotification(testUserId);
            return NextResponse.json({
                success: true,
                message: 'Unified notification test sent',
                results: result.results,
            });
        } else {
            return NextResponse.json(
                { error: 'Invalid test type. Use ?type=basic or ?type=unified' },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('Google Chat test error:', error);
        return NextResponse.json(
            {
                error: 'Test failed',
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}