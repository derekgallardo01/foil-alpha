"use client";

import { useRouter, useSearchParams } from "next/navigation"; // Add useSearchParams
import { Box, Button, Typography, Container, Paper } from "@mui/material";
import GradientHeading from "../components/ui/GradientHeading";
import { motion } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export default function ActivationSuccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = decodeURIComponent(searchParams.get("email") || ""); // Get email from URL

  const handleLoginRedirect = () => {
    if (email) {
      router.push(`/login?email=${encodeURIComponent(email)}`); // Pass email to login
    } else {
      router.push("/login"); // Fallback if no email
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        p: 3,
        background: (t) =>
          `radial-gradient(120% 120% at 20% 0%, #160e2a, ${t.palette.background.default} 62%)`,
      }}
    >
      <Container maxWidth="sm">
        <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Paper elevation={0} sx={{ p: 4, bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: 2, boxShadow: 3 }}>
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
              <motion.div variants={itemVariants}>
                <GradientHeading variant="h5" component="p" sx={{ mb: 1, textAlign: "center" }}>
                  Foil Alpha
                </GradientHeading>
              </motion.div>
              <motion.div variants={itemVariants}>
                <Typography variant="h4" sx={{ mb: 2, textAlign: "center", color: "text.primary" }}>
                  Account Activated!
                </Typography>
              </motion.div>
              <motion.div variants={itemVariants}>
                <Typography sx={{ mb: 3, textAlign: "center", color: "text.secondary" }}>
                  Your account has been successfully verified. You can now log in to Foil Alpha.
                </Typography>
              </motion.div>
              <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  onClick={handleLoginRedirect} // Use handler to pass email
                  aria-label="Go to Login"
                >
                  Log In
                </Button>
              </motion.div>
            </motion.div>
          </Paper>
        </motion.div>
      </Container>
    </Box>
  );
}