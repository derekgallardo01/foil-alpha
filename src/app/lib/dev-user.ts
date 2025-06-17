// Helper functions for development user switching

export interface DevUser {
    id: number;
    name: string;
    email: string;
    role: string;
}

export const defaultDevUser: DevUser = {
    id: 1,
    name: 'Admin User',
    email: 'admin@test.com',
    role: 'admin'
};

// Get current development user from localStorage
export const getCurrentDevUser = (): DevUser => {
    // Only run in browser environment
    if (typeof window === 'undefined') {
        return defaultDevUser;
    }

    try {
        const stored = localStorage.getItem('dev_current_user');
        if (stored) {
            const parsed = JSON.parse(stored);
            // Validate the parsed data has required fields
            if (parsed.id && parsed.name && parsed.email && parsed.role) {
                return parsed;
            }
        }
    } catch (error) {
        console.error('Error parsing stored dev user:', error);
    }

    return defaultDevUser;
};

// Set current development user in localStorage
export const setCurrentDevUser = (user: DevUser): void => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('dev_current_user', JSON.stringify(user));
    }
};

// Check if we're in development mode
export const isDevMode = (): boolean => {
    return process.env.NODE_ENV === 'development';
};

// Available development users
export const devUsers: DevUser[] = [
    { id: 1, name: 'Admin User', email: 'admin@test.com', role: 'admin' },
    { id: 2, name: 'John Collector', email: 'john@test.com', role: 'user' },
    { id: 3, name: 'Sarah Trader', email: 'sarah@test.com', role: 'user' },
    { id: 4, name: 'Mike Bidder', email: 'mike@test.com', role: 'user' },
    { id: 5, name: 'Emma Seller', email: 'emma@test.com', role: 'user' },
];