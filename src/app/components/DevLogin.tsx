// src/app/components/DevLogin.tsx - Fixed version
'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { DEV_USERS } from '../lib/dev-auth';

export default function DevLogin() {
    const [showDevPanel, setShowDevPanel] = useState(false);

    // Only show in development mode
    if (process.env.NODE_ENV !== 'development') return null;

    const handleDevLogin = async (email: string, password: string) => {
        try {
            console.log('🚧 DEV LOGIN: Attempting login with:', email);

            const result = await signIn('credentials', {
                email,
                password,
                redirect: false, // Don't redirect automatically
                callbackUrl: '/'
            });

            console.log('🚧 DEV LOGIN: Result:', result);

            if (result?.error) {
                console.error('Dev login error:', result.error);
                alert('Login failed: ' + result.error);
            } else if (result?.ok) {
                console.log('✅ Dev login success, redirecting...');
                // Force refresh to update session
                window.location.href = '/';
            } else {
                console.error('Unknown login result:', result);
                alert('Login failed - unknown error');
            }
        } catch (error) {
            console.error('Dev login exception:', error);
            alert('Login failed: ' + error);
        }
    };

    return (
        <div className="fixed top-4 right-4 z-50">
            {/* Toggle Button */}
            <button
                onClick={() => setShowDevPanel(!showDevPanel)}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-lg"
            >
                🚧 DEV
            </button>

            {/* Dev Panel */}
            {showDevPanel && (
                <div className="absolute top-12 right-0 bg-gray-900 border border-yellow-400 rounded-lg p-4 shadow-xl min-w-[300px]">
                    <h3 className="text-yellow-400 font-semibold mb-3 text-center">
                        🚧 Development Quick Login
                    </h3>

                    <div className="space-y-2">
                        {DEV_USERS.map((user) => (
                            <button
                                key={user.id}
                                onClick={() => handleDevLogin(user.email, user.password)}
                                className={`w-full px-3 py-2 rounded text-white font-medium transition-colors text-sm ${user.role === 'admin'
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : 'bg-blue-600 hover:bg-blue-700'
                                    }`}
                            >
                                <div className="text-left">
                                    <div className="font-semibold">{user.name}</div>
                                    <div className="text-xs opacity-75">{user.email}</div>
                                    <div className="text-xs opacity-75">Password: {user.password}</div>
                                    <div className="text-xs opacity-75">({user.role})</div>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="mt-3 pt-2 border-t border-gray-700">
                        <p className="text-xs text-gray-400 text-center">
                            ⚠️ Development mode only
                        </p>
                        <p className="text-xs text-gray-400 text-center mt-1">
                            Check console for login details
                        </p>
                    </div>

                    <button
                        onClick={() => setShowDevPanel(false)}
                        className="absolute top-1 right-2 text-gray-400 hover:text-white"
                    >
                        ×
                    </button>
                </div>
            )}
        </div>
    );
}