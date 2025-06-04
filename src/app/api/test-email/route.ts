import { NextResponse } from 'next/server';
import testEmail from '../../lib/test-email';

// Define a custom error interface
interface CustomError extends Error {
  response?: {
    data?: unknown;
  };
  code?: string;
  config?: unknown;
}

export async function GET() {
  try {
    console.log('Starting test-email route');
    console.log('Environment variables:', {
      GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN ? 'SET' : 'NOT SET',
      NODE_ENV: process.env.NODE_ENV,
    });

    console.log('Attempting to call testEmail function...');
    const result = await testEmail();
    console.log('Email response:', result);

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      data: result,
    });
  } catch (error: unknown) {
    // Initialize customError with fallback values
    let customError: CustomError;

    if (error instanceof Error) {
      // Extend the Error object to include CustomError properties
      customError = error as CustomError;
    } else {
      // Handle non-Error cases (e.g., string, object, etc.)
      customError = new Error('Unknown error') as CustomError;
    }

    console.error('Error in test-email route:', {
      message: customError.message,
      stack: customError.stack,
      response: customError.response?.data, // Safe access with optional chaining
    });

    console.error('Full error object:', {
      name: customError.name,
      message: customError.message,
      stack: customError.stack,
      response: customError.response, // Safe, as it's optional in CustomError
      code: customError.code, // Safe, as it's optional in CustomError
      config: customError.config, // Safe, as it's optional in CustomError
    });

    console.error('Error string:', String(customError));

    return NextResponse.json(
      {
        error: 'Failed to send test email',
        details: {
          message: customError.message,
          stack: customError.stack,
          response: customError.response?.data, // Safe access with optional chaining
        },
      },
      { status: 500 }
    );
  }
}