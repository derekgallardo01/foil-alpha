'use client';
import React from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Settings from '../components/Settings'; // Adjust path as needed
import { Container, Typography, Box } from '@mui/material';
import AppShell from '../components/AppShell';

const SettingsPage = () => {
  const { status } = useSession();
  const router = useRouter();

  if (status === 'loading') {
    return <Typography>Loading...</Typography>;
  }

  if (status === 'unauthenticated') {
    router.push('/auth/signin');
    return null;
  }

  return (
    <AppShell>
      <Container sx={{ marginTop: 4, marginBottom: 4 }}>
        <Box sx={{ my: 3 }}>
          <Typography variant="h4" gutterBottom>
            Settings
          </Typography>
        </Box>
        <Settings />
      </Container>
    </AppShell>
  );
};

export default SettingsPage;