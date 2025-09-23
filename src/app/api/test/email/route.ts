import { NextRequest, NextResponse } from 'next/server';
import { createNotification } from '../../../lib/notification';

export async function POST(request: NextRequest) {
  try {
    // For testing, use a hardcoded user ID (replace with an actual user ID from your database)
    const testUserId = 1; // Change this to a real user ID

    const result = await createNotification({
      user_id: testUserId,
      type: 'SYSTEM_NOTIFICATION',
      title: 'Email Test Notification',
      message: 'This is a test to verify that email notifications are working correctly.',
      data: {
        test: true,
        timestamp: new Date().toISOString(),
        card_name: 'Test Card',
        amount: 25.99
      }
    });

    return NextResponse.json({
      success: true,
      notification: result,
      message: 'Test email notification sent successfully'
    });
  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json(
      { error: 'Failed to send test email', details: (error as Error).message },
      { status: 500 }
    );
  }
}