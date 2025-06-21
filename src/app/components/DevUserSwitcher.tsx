'use client';
import React from 'react';
import { Box, Button, Typography, Paper, Chip } from '@mui/material';
import { SwapHoriz as SwapIcon, Person as PersonIcon } from '@mui/icons-material';

interface DevUser {
    id: number;
    name: string;
    email: string;
    role: string;
}

const devUsers: DevUser[] = [
    { id: 1, name: 'Admin User', email: 'admin@test.com', role: 'admin' },
    { id: 2, name: 'John Collector', email: 'john@test.com', role: 'user' },
    { id: 3, name: 'Sarah Trader', email: 'sarah@test.com', role: 'user' },
    { id: 4, name: 'Mike Bidder', email: 'mike@test.com', role: 'user' },
    { id: 5, name: 'Emma Seller', email: 'emma@test.com', role: 'user' },
];

export default function DevUserSwitcher() {
    const [currentUser, setCurrentUser] = React.useState<DevUser>(devUsers[0]);
    const [isExpanded, setIsExpanded] = React.useState(false);

    React.useEffect(() => {
        const stored = localStorage.getItem('dev_current_user');
        if (stored) {
            try {
                setCurrentUser(JSON.parse(stored));
            } catch (error) {
                console.error('Error parsing stored user:', error);
            }
        }
    }, []);

    // Only render in development
    if (process.env.NODE_ENV !== 'development') return null;

    const switchUser = (user: DevUser) => {
        localStorage.setItem('dev_current_user', JSON.stringify(user));
        setCurrentUser(user);
        setIsExpanded(false);
        window.location.reload();
    };

    return (
        <Paper
            sx={{
                position: 'fixed',
                top: 10,
                left: 10,
                p: 2,
                zIndex: 9999,
                bgcolor: 'warning.light',
                minWidth: 200,
                boxShadow: 3,
                border: '2px solid',
                borderColor: 'warning.main'
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PersonIcon fontSize="small" color="warning" />
                <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'warning.dark' }}>
                    DEV MODE
                </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Current User:
                </Typography>
                <Chip
                    label={`${currentUser.name}`}
                    color="primary"
                    size="small"
                    sx={{ fontSize: '0.7rem' }}
                />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    ID: {currentUser.id} | Role: {currentUser.role}
                </Typography>
            </Box>

            <Button
                size="small"
                variant="outlined"
                onClick={() => setIsExpanded(!isExpanded)}
                sx={{
                    fontSize: '0.7rem',
                    mb: isExpanded ? 1 : 0,
                    width: '100%'
                }}
                startIcon={<SwapIcon />}
            >
                {isExpanded ? 'Hide Users' : 'Switch User'}
            </Button>

            {isExpanded && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {devUsers.map((user) => (
                        <Button
                            key={user.id}
                            size="small"
                            variant={user.id === currentUser.id ? "contained" : "outlined"}
                            onClick={() => switchUser(user)}
                            sx={{
                                fontSize: '0.7rem',
                                justifyContent: 'flex-start',
                                textTransform: 'none'
                            }}
                            disabled={user.id === currentUser.id}
                        >
                            {user.name} ({user.role})
                        </Button>
                    ))}
                </Box>
            )}
        </Paper>
    );
}