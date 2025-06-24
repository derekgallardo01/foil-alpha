// Create: src/app/lib/dev-bypass.ts
// Development-only authentication bypass

export const isDevelopment = process.env.NODE_ENV === 'development';

// Development bypass configuration
export const DEV_BYPASS = {
    SKIP_EMAIL_VERIFICATION: isDevelopment && process.env.DEV_SKIP_EMAIL === 'true',
    SKIP_EMAIL_SENDING: isDevelopment && process.env.DEV_SKIP_EMAIL_SEND === 'true',
    AUTO_VERIFY_USERS: isDevelopment && process.env.DEV_AUTO_VERIFY === 'true',
};

// Mock email function for development
export async function mockSendEmail(to: string, subject: string) {
    if (!isDevelopment) {
        throw new Error('Mock email function should only be used in development');
    }

    console.log('🚀 DEV MODE: Email sending bypassed');
    console.log('📧 Would have sent email to:', to);
    console.log('📝 Subject:', subject);
    console.log('✅ Returning success without actually sending');

    return {
        success: true,
        messageId: `dev-mock-${Date.now()}`,
        message: 'Development mode: Email bypassed'
    };
}

// Get verification status for development
export function getDevVerificationStatus() {
    if (!isDevelopment || !DEV_BYPASS.AUTO_VERIFY_USERS) {
        return { is_verified: false };
    }

    console.log('🚀 DEV MODE: Auto-verifying user');
    return { is_verified: true };
}