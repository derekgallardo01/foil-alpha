"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
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
  IconButton,
  InputAdornment,
  Alert,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import Image from "next/image";
import { motion } from "framer-motion";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { GoogleAnalytics } from "nextjs-google-analytics";
import SocialLogins from "../components/SocialLogins";

// Custom error type
interface RegisterError extends Error {
  status?: number;
  code?: string;
}

// API response type
interface RegisterResponse {
  autoVerified?: boolean;
  message?: string;
  code?: string; // Added to match potential API response
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

// Simplified validation for dev mode
const validateForm = (email: string, password: string, name: string): string | null => {
  if (!email.trim() || !password.trim() || !name.trim()) return "All fields are required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Please enter a valid email address";
  if (name.trim().length < 2) return "Name must be at least 2 characters long";
  if (password.trim().length < 8) return "Password must be at least 8 characters long";
  return null;
};

export default function RegisterClient() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isNetworkError, setIsNetworkError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [devMode] = useState(process.env.NODE_ENV === "development");
  const router = useRouter();

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsNetworkError(false);
    setSuccess(false);

    const validationError = validateForm(email, password, name);
    if (validationError) {
      setError(validationError);
      return;
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedPassword = password.trim();
    const sanitizedName = name.trim();

    try {
      setLoading(true);
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: sanitizedEmail,
          password: sanitizedPassword,
          name: sanitizedName,
        }),
      });

      if (!response) {
        throw new Error("No response from server");
      }

      const data: RegisterResponse = await response.json();

      if (response.ok) {
        handleSuccess(sanitizedEmail, data);
      } else {
        throw Object.assign(new Error(data.message || "Registration failed"), {
          status: response.status,
          code: data.code,
        }) as RegisterError;
      }
    } catch (err) {
      handleError(err as RegisterError);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = (email: string, data: RegisterResponse) => {
    setSuccess(true);

    if (devMode && data.autoVerified) {
      // In dev mode with auto-verification, redirect to login
      toast.success("Registration successful! Auto-verified for development. You can now login.", {
        autoClose: 3000,
      });
      setTimeout(() => {
        router.push(`/login?email=${encodeURIComponent(email)}`);
      }, 2000);
    } else {
      // Normal flow - redirect to email verification
      toast.success("Registration successful! Please check your email to verify.", { autoClose: 2000 });
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    }
  };

  const handleError = (err: RegisterError) => {
    let errorMessage = "An unexpected error occurred. Please try again.";

    if (err.status === 400) {
      errorMessage = err.message || "Invalid request. Please check your inputs.";
    } else if (err.status === 409) {
      errorMessage = "Email already registered. Please use a different email.";
    } else if (err.status === 429) {
      errorMessage = "Too many requests. Please try again later.";
    } else if (!navigator.onLine || err.message.includes("network")) {
      errorMessage = "Network connection lost. Please check your internet.";
      setIsNetworkError(true);
    }

    setError(errorMessage);
    toast.error(errorMessage);
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
        position: "relative",
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
      <ToastContainer position="top-right" />
      <Backdrop sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }} open={loading}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <GoogleAnalytics trackPageViews debugMode={true} />

      <Container maxWidth="sm" sx={{ position: "relative", zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <motion.div initial={{ rotateY: 180 }} animate={{ rotateY: 0 }} transition={{ duration: 0.6 }}>
            <Paper
              elevation={6}
              sx={{
                p: 4,
                bgcolor: "grey.900",
                backgroundImage: "linear-gradient(#000000, rgba(0, 0, 0, 0))",
                borderRadius: 2,
                boxShadow: "0 0 10px rgba(155, 92, 255, 0.21)",
              }}
            >
              <Box sx={{ mb: 2, display: "flex", justifyContent: "center" }}>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                >
                  <Image
                    src="https://i.ibb.co/ZBphxdZ/TCG-Market.png"
                    alt="Foil Alpha Logo"
                    width={200}
                    height={100}
                    priority
                  />
                </motion.div>
              </Box>

              {/* DEV MODE: Info Alert */}
              {devMode && (
                <motion.div variants={itemVariants}>
                  <Alert severity="info" sx={{ mb: 3 }}>
                    <Typography variant="body2">
                      🚧 <strong>Development Mode:</strong> New accounts will be automatically verified and can login
                      immediately - no email verification required!
                    </Typography>
                  </Alert>
                </motion.div>
              )}

              <Box sx={{ width: "100%" }}>
                <Typography variant="h4" sx={{ mb: 3, textAlign: "center", color: "text.primary" }}>
                  User Registration
                </Typography>
                <Typography variant="subtitle1" sx={{ mb: 2, textAlign: "center", color: "text.secondary" }}>
                  Create your Foil Alpha account
                </Typography>

                <motion.div variants={containerVariants} initial="hidden" animate="visible">
                  <form onSubmit={handleRegister}>
                    <motion.div variants={itemVariants}>
                      <TextField
                        autoFocus
                        tabIndex={1}
                        label="Full Name"
                        fullWidth
                        required
                        margin="normal"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        variant="outlined"
                        InputLabelProps={{ style: { color: "text.secondary" } }}
                        sx={{ input: { color: "text.primary" } }}
                        disabled={loading || success}
                        aria-label="Full Name"
                        autoComplete="name"
                        placeholder="Enter your full name"
                      />
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <TextField
                        tabIndex={2}
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
                        disabled={loading || success}
                        aria-label="Email Address"
                        autoComplete="email"
                        placeholder="Enter your email address"
                      />
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <TextField
                        tabIndex={3}
                        label="Password"
                        type={showPassword ? "text" : "password"}
                        fullWidth
                        required
                        margin="normal"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        variant="outlined"
                        InputLabelProps={{ style: { color: "text.secondary" } }}
                        sx={{ input: { color: "text.primary" } }}
                        disabled={loading || success}
                        aria-label="Password"
                        autoComplete="new-password"
                        placeholder="Enter a password (8+ characters)"
                        helperText="Minimum 8 characters required"
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                aria-label="toggle password visibility"
                                onClick={() => setShowPassword(!showPassword)}
                                edge="end"
                                disabled={loading || success}
                                sx={{ color: "text.secondary" }}
                              >
                                {showPassword ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                      />
                    </motion.div>

                    {(error || isNetworkError) && (
                      <motion.div variants={itemVariants}>
                        <Typography
                          color={isNetworkError ? "warning" : "error"}
                          sx={{ mt: 1, textAlign: "center" }}
                          role="alert"
                        >
                          {error}
                          {isNetworkError && (
                            <Button
                              size="small"
                              onClick={() => handleRegister({ preventDefault: () => {} } as FormEvent<HTMLFormElement>)}
                              sx={{ ml: 1 }}
                            >
                              Retry
                            </Button>
                          )}
                        </Typography>
                      </motion.div>
                    )}

                    <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        sx={{ mt: 3, bgcolor: "#9B5Cff", color: "grey.900" }}
                        disabled={loading || success}
                        aria-label="Register"
                      >
                        {loading ? <CircularProgress size={24} color="inherit" /> : "Register"}
                      </Button>
                    </motion.div>
                  </form>

                  <SocialLogins callbackUrl="/dashboard" />

                  <motion.div variants={itemVariants}>
                    <Typography variant="body2" sx={{ mt: 2, textAlign: "center", color: "text.secondary" }}>
                      Already have an account?{" "}
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