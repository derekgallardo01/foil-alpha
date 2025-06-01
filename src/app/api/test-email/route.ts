import { NextResponse } from 'next/server';
import testEmail from '../../lib/test-email';

export async function GET() {
  try {
    console.log('Starting test-email route');
    console.log('Environment variables:', {
      GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN ? 'SET' : 'NOT SET',
      NODE_ENV: process.env.NODE_ENV
    });

    console.log('Attempting to call testEmail function...');
    const result = await testEmail();
    console.log('Email response:', result);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Email sent successfully',
      data: result
    });
  } catch (error: any) {
    console.error('Error in test-email route:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    
    // Log the full error object
    console.error('Full error object:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      response: error.response,
      code: error.code,
      config: error.config
    });
    
    // Log the error as a string
    console.error('Error string:', String(error));
    
    return NextResponse.json(
      { 
        error: 'Failed to send test email',
        details: {
          message: error.message,
          stack: error.stack,
          response: error.response?.data
        }
      },
      { status: 500 }
    );
  }
}
