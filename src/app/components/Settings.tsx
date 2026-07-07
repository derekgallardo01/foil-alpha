'use client';
import React, { useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  TextField,
  Button,
} from "@mui/material";
import Grid from '@mui/material/Grid2';

const Settings = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");

  const handleSaveSettings = () => {
    // Add logic to save username and email (e.g., API call)
    console.log("Saving settings:", { username, email });
  };

  const handleUpdateNotificationEmail = () => {
    // Add logic to update notification email (e.g., API call)
    console.log("Updating notification email:", notificationEmail);
  };

  return (
    <Grid container spacing={2}>
      {/* Account Settings Card */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom>Account Settings</Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label="Username"
                variant="outlined"
                fullWidth
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <TextField
                label="Email"
                variant="outlined"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button variant="contained" color="primary" onClick={handleSaveSettings}>
                Save Settings
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Notifications Card */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom>Notifications</Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label="Email"
                variant="outlined"
                fullWidth
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
              />
              <Button variant="contained" color="primary" onClick={handleUpdateNotificationEmail}>
                Update Email
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default Settings;