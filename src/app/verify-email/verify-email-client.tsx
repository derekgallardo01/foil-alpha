// app/verify-email/verify-email-client.tsx
"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Container,
  Paper,
} from "@mui/material";
import { motion } from "framer-motion";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export default function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = decodeURIComponent(searchParams.get("email") || "");
  const [code, setCode] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError("Please enter the verification code.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: code.trim() }),
      });
    
      if (response.ok) {
        toast.success("Email verified successfully!", { autoClose: 2000 });
        router.push("/activation-success");
      } else {
        const data = await response.json();
        setError(data.message || "Invalid verification code.");
        toast.error(data.message || "Verification failed.");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      toast.error("An unexpected error occurred.");
    } finally {
      setLoading(false);
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
      <ToastContainer position="top-right" />
      <Container maxWidth="sm">
        <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Paper elevation={0} sx={{ p: 4, bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: 2, boxShadow: 3 }}>
            <Typography
              variant="h5"
              component="p"
              sx={{
                mb: 1,
                textAlign: "center",
                background: (t) => t.foil.gradient,
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 800,
              }}
            >
              Foil Alpha
            </Typography>
            <Typography variant="h4" sx={{ mb: 2, textAlign: "center", color: "text.primary" }}>
              Verify Your Email
            </Typography>
            <Typography sx={{ mb: 2, textAlign: "center", color: "text.secondary" }}>
              We sent a code to <strong>{email}</strong>. Enter it below to verify your account.
            </Typography>

            <motion.div variants={containerVariants} initial="hidden" animate="visible">
              <form onSubmit={handleVerify}>
                <motion.div variants={itemVariants}>
                  <TextField
                    label="Verification Code"
                    fullWidth
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    variant="outlined"
                    InputLabelProps={{ style: { color: "text.secondary" } }}
                    sx={{
                      input: {
                        color: "text.primary",
                        fontFamily: (t) => t.typography.mono.fontFamily,
                        letterSpacing: "0.2em",
                      },
                    }}
                    disabled={loading}
                    aria-label="Verification Code"
                  />
                </motion.div>

                {error && (
                  <motion.div variants={itemVariants}>
                    <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>
                  </motion.div>
                )}

                <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    color="primary"
                    sx={{ mt: 3 }}
                    disabled={loading}
                    aria-label="Verify Email"
                  >
                    {loading ? <CircularProgress size={24} color="inherit" /> : "Verify"}
                  </Button>
                </motion.div>
              </form>
            </motion.div>
          </Paper>
        </motion.div>
      </Container>
    </Box>
  );
}