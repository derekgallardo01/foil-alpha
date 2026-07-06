"use client";

import { useState, FormEvent } from "react";

import {
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Link,
  Container,
  Paper,
  Backdrop,
} from "@mui/material";
import { motion } from "framer-motion";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { GoogleAnalytics, event as gaEvent } from "nextjs-google-analytics";

// Custom error type
interface ForgotPasswordError extends Error {
  status?: number;
  code?: string;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

// Validation utility
const validateEmail = (email: string): string | null => {
  const sanitizedEmail = email.trim().toLowerCase();
  if (!sanitizedEmail) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
    return "Please enter a valid email address";
  }
  return null;
};

export default function ForgotPasswordClient() {
  const [email, setEmail] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isNetworkError, setIsNetworkError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setMessage(null);
    setError(null);
    setIsNetworkError(false);

    const validationError = validateEmail(email);
    if (validationError) {
      setError(validationError);
      gaEvent("forgot_password_attempt", {
        category: "Forgot Password",
        label: `Validation Failed - ${validationError}`,
        value: 0,
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (response.ok) {
        handleSuccess();
      } else {
        const data = await response.json();
        throw Object.assign(new Error(data.message || "Something went wrong"), {
          status: response.status,
          code: data.code,
        }) as ForgotPasswordError;
      }
    } catch (err) {
      handleError(err as ForgotPasswordError);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    const successMessage = "If an account exists, a password reset link has been sent to your email.";
    setMessage(successMessage);
    toast.success(successMessage, { autoClose: 3000 });
    gaEvent("forgot_password_attempt", {
      category: "Forgot Password",
      label: "Success",
      value: 1,
    });
  };

  const handleError = (err: ForgotPasswordError) => {
    let errorMessage = "An error occurred. Please try again later.";
    const eventLabel = ["Failed"];

    if (err.status === 429) {
      errorMessage = "Too many requests. Please try again later.";
      eventLabel.push("Rate Limited");
    } else if (err.status === 400) {
      errorMessage = "Invalid request. Please check your email.";
      eventLabel.push("Bad Request");
    } else if (!navigator.onLine || err.message.includes("network")) {
      errorMessage = "Network connection lost. Please check your internet.";
      setIsNetworkError(true);
      eventLabel.push("Network Error");
    }

    setError(errorMessage);
    gaEvent("forgot_password_attempt", {
      category: "Forgot Password",
      label: eventLabel.join(" - "),
      value: 0,
    });
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
        position: "relative",
        background: (t) =>
          `radial-gradient(120% 120% at 20% 0%, #160e2a, ${t.palette.background.default} 62%)`,
      }}
    >
      <ToastContainer position="top-right" />
      <Backdrop sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }} open={loading}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <GoogleAnalytics trackPageViews debugMode={true} />

      <Container maxWidth="sm" sx={{ position: "relative", zIndex: 1 }}>
        <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
          <motion.div initial={{ rotateY: 180 }} animate={{ rotateY: 0 }} transition={{ duration: 0.6 }}>
            <Paper elevation={0} sx={{ p: 4, bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: 2, boxShadow: 3 }}>
              <Typography
                variant="h5"
                component="p"
                sx={{
                  mb: 2,
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
              <Box sx={{ width: "100%" }}>
                <Typography variant="h4" sx={{ mb: 3, textAlign: "center", color: "text.primary" }}>
                  Forgot Password
                </Typography>
                <Typography variant="subtitle1" sx={{ mb: 2, textAlign: "center", color: "text.secondary" }}>
                  Enter your email to receive a password reset link
                </Typography>

                <motion.div variants={containerVariants} initial="hidden" animate="visible">
                  <form onSubmit={handleSubmit}>
                    <motion.div variants={itemVariants}>
                      <TextField
                        autoFocus
                        tabIndex={1}
                        label="Email Address"
                        type="email"
                        fullWidth
                        required
                        margin="normal"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        variant="outlined"
                        InputLabelProps={{ style: { color: "text.secondary" } }}
                        sx={{ input: { color: "text.primary" } }}
                        disabled={loading}
                        aria-label="Email Address"
                        autoComplete="email"
                        inputProps={{ "aria-describedby": error ? "email-error" : undefined }}
                      />
                    </motion.div>

                    {(error || isNetworkError) && (
                      <motion.div variants={itemVariants}>
                        <Typography
                          id="email-error"
                          color={isNetworkError ? "warning" : "error"}
                          sx={{ mt: 1, textAlign: "center" }}
                          role="alert"
                        >
                          {error}
                          {isNetworkError && (
                            <Button
                              size="small"
                              onClick={() => handleSubmit()}
                              sx={{ ml: 1 }}
                            >
                              Retry
                            </Button>
                          )}
                        </Typography>
                      </motion.div>
                    )}
                    {message && (
                      <motion.div variants={itemVariants}>
                        <Typography color="success.main" sx={{ mt: 1, textAlign: "center" }} role="status">
                          {message}
                        </Typography>
                      </motion.div>
                    )}

                    <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        color="primary"
                        sx={{ mt: 3 }}
                        disabled={loading || !!message}
                        aria-label="Send Reset Link"
                      >
                        {loading ? <CircularProgress size={24} color="inherit" /> : "Send Reset Link"}
                      </Button>
                    </motion.div>
                  </form>

                  <motion.div variants={itemVariants}>
                    <Typography variant="body2" sx={{ mt: 2, textAlign: "center", color: "text.secondary" }}>
                      Back to{" "}
                      <Link href="/login" underline="hover" sx={{ color: "primary.main", cursor: "pointer" }}>
                        Login
                      </Link>
                    </Typography>
                  </motion.div>
                </motion.div>
              </Box>
            </Paper>
          </motion.div>
        </motion.div>
      </Container>
    </Box>
  );
}