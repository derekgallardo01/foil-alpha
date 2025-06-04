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
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import Image from "next/image";
import { motion } from "framer-motion";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { GoogleAnalytics, event as gaEvent } from "nextjs-google-analytics";

// Custom error type
interface RegisterError extends Error {
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

// Validation utility (removed password length requirement)
const validateForm = (email: string, password: string, name: string): string | null => {
  const sanitizedEmail = email.trim().toLowerCase();
  const sanitizedPassword = password.trim();
  const sanitizedName = name.trim();

  if (!sanitizedEmail || !sanitizedPassword || !sanitizedName) return "All fields are required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) return "Please enter a valid email address";
  if (sanitizedName.length < 2) return "Name must be at least 2 characters long";
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
  const [success, setSuccess] = useState<boolean>(false); // Track success state
  const router = useRouter();

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsNetworkError(false);
    setSuccess(false);

    const validationError = validateForm(email, password, name);
    if (validationError) {
      setError(validationError);
      gaEvent("register_attempt", {
        category: "Register",
        label: `Validation Failed - ${validationError}`,
        value: 0,
      });
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
        body: JSON.stringify({ email: sanitizedEmail, password: sanitizedPassword, name: sanitizedName }),
      });

      if (!response) {
        throw new Error("No response from server");
      }

      const data = await response.json();

      if (response.ok) {
        handleSuccess(sanitizedEmail);
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

  const handleSuccess = (email: string) => {
    setSuccess(true);
    toast.success("Registration successful! Please check your email to verify.", { autoClose: 2000 });
    gaEvent("register_attempt", {
      category: "Register",
      label: "Success",
      value: 1,
    });
    router.push(`/verify-email?email=${encodeURIComponent(email)}`);
  };

  const handleError = (err: RegisterError) => {
    let errorMessage = "An unexpected error occurred. Please try again.";
    const eventLabel = ["Failed"];

    if (err.status === 400) {
      errorMessage = "Invalid request. Please check your inputs.";
      eventLabel.push("Bad Request");
    } else if (err.status === 409) {
      errorMessage = "Email already registered. Please use a different email.";
      eventLabel.push("Email Exists");
    } else if (err.status === 429) {
      errorMessage = "Too many requests. Please try again later.";
      eventLabel.push("Rate Limited");
    } else if (!navigator.onLine || err.message.includes("network")) {
      errorMessage = "Network connection lost. Please check your internet.";
      setIsNetworkError(true);
      eventLabel.push("Network Error");
    }

    setError(errorMessage);
    toast.error(errorMessage);
    gaEvent("register_attempt", {
      category: "Register",
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
        <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
          <motion.div initial={{ rotateY: 180 }} animate={{ rotateY: 0 }} transition={{ duration: 0.6 }}>
            <Paper elevation={6} sx={{ p: 4, bgcolor: "grey.900", backgroundImage: "linear-gradient(#000000, rgba(0, 0, 0, 0))", borderRadius: 2, boxShadow: "0 0 10px rgba(150, 255, 155, 0.21)" }}>
              <Box sx={{ mb: 2, display: "flex", justifyContent: "center" }}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
                  <Image src="https://i.ibb.co/ZBphxdZ/TCG-Market.png" alt="TCG Market Logo" width={200} height={100} priority />
                </motion.div>
              </Box>
              <Box sx={{ width: "100%" }}>
                <Typography variant="h4" sx={{ mb: 3, textAlign: "center", color: "text.primary" }}>
                  User Registration
                </Typography>
                <Typography variant="subtitle1" sx={{ mb: 2, textAlign: "center", color: "text.secondary" }}>
                  Create your TCG Market account
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
                        inputProps={{ "aria-describedby": error ? "form-error" : undefined }}
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
                        inputProps={{ "aria-describedby": error ? "form-error" : undefined }}
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
                        inputProps={{ "aria-describedby": error ? "form-error" : undefined }}
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
                          id="form-error"
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
                        sx={{ mt: 3, bgcolor: "#96ff9b", color: "grey.900" }}
                        disabled={loading || success} // Disable after success
                        aria-label="Register"
                      >
                        {loading ? <CircularProgress size={24} color="inherit" /> : "Register"}
                      </Button>
                    </motion.div>
                  </form>

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