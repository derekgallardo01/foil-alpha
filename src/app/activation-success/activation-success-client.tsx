"use client";

import { useRouter, useSearchParams } from "next/navigation"; // Add useSearchParams
import { Box, Button, Typography, Container, Paper } from "@mui/material";
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
        bgcolor: "grey.900",
        p: 3,
        background: "linear-gradient(181deg, #000000bd, #031e04, #0000002b, #000000d4)",
        backgroundSize: "200% 200%",
        animation: "gradientShift 20s ease infinite",
        "@keyframes gradientShift": {
          "0%": { backgroundPosition: "0% 0%" },
          "50%": { backgroundPosition: "100% 100%" },
          "100%": { backgroundPosition: "0% 0%" },
        },
      }}
    >
      <Container maxWidth="sm">
        <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Paper elevation={6} sx={{ p: 4, bgcolor: "grey.900", backgroundImage: "linear-gradient(#000000, rgba(0, 0, 0, 0))", borderRadius: 2, boxShadow: "0 0 10px rgba(150, 255, 155, 0.21)" }}>
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
              <motion.div variants={itemVariants}>
                <Typography variant="h4" sx={{ mb: 2, textAlign: "center", color: "text.primary" }}>
                  Account Activated!
                </Typography>
              </motion.div>
              <motion.div variants={itemVariants}>
                <Typography sx={{ mb: 3, textAlign: "center", color: "text.secondary" }}>
                  Your account has been successfully verified. You can now log in to TCG Market.
                </Typography>
              </motion.div>
              <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  fullWidth
                  variant="contained"
                  sx={{ bgcolor: "#96ff9b", color: "grey.900" }}
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