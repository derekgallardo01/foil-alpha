"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { signIn, SignInResponse } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Link,
  Container,
  Paper,
  Checkbox,
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
import DiscordIcon from "../components/icons/DiscordIcon"; // Adjust path as needed

// Custom error type
interface AuthError extends Error {
  status?: number;
  code?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

// Validation utility
const validateForm = (email: string, password: string): string | null => {
  const sanitizedEmail = email.trim().toLowerCase();
  const sanitizedPassword = password.trim();

  if (!sanitizedEmail) return "Email is required";
  if (!sanitizedPassword) return "Password is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
    return "Please enter a valid email address";
  }
  if (sanitizedPassword.length < 8) {
    return "Password must be at least 8 characters long";
  }
  return null;
};

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const emailFromQuery = searchParams.get("email");
    if (emailFromQuery) {
      setEmail(decodeURIComponent(emailFromQuery));
      if (passwordRef.current) {
        passwordRef.current.focus();
      }
      router.replace("/login", { scroll: false });
      return;
    }

    const savedEmail = localStorage.getItem("rememberedEmail");
    const savedRememberMe = localStorage.getItem("rememberMe") === "true";
    if (savedEmail && savedRememberMe) {
      setEmail(savedEmail);
      setRememberMe(true);
      if (passwordRef.current) {
        passwordRef.current.focus();
      }
    }
  }, [searchParams, router]);

  const performLogin = async () => {
    setError(null);
    setIsNetworkError(false);

    const validationError = validateForm(email, password);
    if (validationError) {
      setError(validationError);
      gaEvent("login_attempt", {
        category: "Login",
        label: `Validation Failed - ${validationError}`,
        value: 0,
      });
      return;
    }

    try {
      setLoading(true);
      const result = await signIn("credentials", {
        redirect: false,
        email: email.trim().toLowerCase(),
        password: password.trim(),
      }) as SignInResponse;

      if (!result) {
        throw new Error("No response from authentication server");
      }

      if (result.error) {
        throw Object.assign(new Error(result.error), {
          status: result.status,
          code: result.error,
        }) as AuthError;
      }

      if (result.ok) {
        handleSuccessfulLogin();
      }
    } catch (err) {
      handleLoginError(err as AuthError);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (event?: FormEvent<HTMLFormElement>) => {
    if (event) {
      event.preventDefault();
    }
    await performLogin();
  };

  const handleSocialLogin = async (provider: "discord" | "google") => {
    try {
      setLoading(true);
      setError(null);
      setIsNetworkError(false);

      const result = await signIn(provider, {
        callbackUrl: "/dashboard",
        redirect: false,
      }) as SignInResponse;

      if (!result) {
        throw new Error(`No response from ${provider} authentication`);
      }

      if (result.error) {
        throw Object.assign(new Error(result.error), {
          status: result.status,
          code: result.error,
        }) as AuthError;
      }

      gaEvent("login_attempt", {
        category: "Social Login",
        label: `Success - ${provider}`,
        value: 1,
      });
      router.push("/dashboard");
    } catch (err) {
      handleSocialLoginError(err as AuthError, provider);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessfulLogin = () => {
    if (rememberMe) {
      localStorage.setItem("rememberedEmail", email.trim().toLowerCase());
      localStorage.setItem("rememberMe", "true");
    } else {
      localStorage.removeItem("rememberedEmail");
      localStorage.removeItem("rememberMe");
    }
    toast.success("Logged in successfully!", { autoClose: 2000 });
    gaEvent("login_attempt", {
      category: "Login",
      label: "Success",
      value: 1,
    });
    router.push("/dashboard");
  };

  const handleLoginError = (err: AuthError) => {
    let errorMessage = "An unexpected error occurred. Please try again.";
    const eventLabel = ["Failed"];

    if (err.status === 401) {
      errorMessage = "Invalid email or password";
      eventLabel.push("Invalid Credentials");
    } else if (err.status === 429) {
      errorMessage = "Too many login attempts. Please try again later";
      eventLabel.push("Rate Limited");
    } else if (!navigator.onLine || err.message.includes("network")) {
      errorMessage = "Network connection lost. Please check your internet";
      setIsNetworkError(true);
      eventLabel.push("Network Error");
    }

    setError(errorMessage);
    gaEvent("login_attempt", {
      category: "Login",
      label: eventLabel.join(" - "),
      value: 0,
    });
  };

  const handleSocialLoginError = (err: AuthError, provider: string) => {
    let errorMessage = `Failed to login with ${provider}`;
    const eventLabel = [`Failed - ${provider}`];

    if (err.status === 403) {
      errorMessage = `${provider} access denied`;
      eventLabel.push("Access Denied");
    } else if (err.status === 503) {
      errorMessage = `${provider} service unavailable`;
      eventLabel.push("Service Unavailable");
    } else if (!navigator.onLine || err.message.includes("network")) {
      errorMessage = "Network connection lost";
      setIsNetworkError(true);
      eventLabel.push("Network Error");
    }

    setError(errorMessage);
    gaEvent("login_attempt", {
      category: "Social Login",
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
                <Typography variant="h4" sx={{ mb: 3, textAlign: "center", color: "text.primary" }}>User Login</Typography>
                <Typography variant="subtitle1" sx={{ textAlign: "center", color: "text.secondary" }}>Access your TCG Market account</Typography>

                <motion.div variants={containerVariants} initial="hidden" animate="visible">
                  <form onSubmit={handleLogin}>
                    <motion.div variants={itemVariants}>
                      <TextField
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
                      />
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <TextField
                        inputRef={passwordRef}
                        tabIndex={2}
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
                        disabled={loading}
                        aria-label="Password"
                        autoComplete="current-password"
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                aria-label="toggle password visibility"
                                onClick={() => setShowPassword(!showPassword)}
                                edge="end"
                                disabled={loading}
                                sx={{ color: "text.secondary" }}
                              >
                                {showPassword ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                      />
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
                        <Checkbox
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          sx={{ color: "text.secondary" }}
                          disabled={loading}
                          aria-label="Remember me"
                        />
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>Remember Me</Typography>
                      </Box>
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <Typography variant="body2" sx={{ mt: 1, textAlign: "center" }}>
                        <Link href="/forgot-password" underline="hover" sx={{ color: "primary.main" }}>Forgot Password?</Link>
                      </Typography>
                    </motion.div>

                    {(error || isNetworkError) && (
                      <motion.div variants={itemVariants}>
                        <Typography 
                          color={isNetworkError ? "warning" : "error"} 
                          sx={{ mt: 1, textAlign: "center" }}
                        >
                          {error}
                          {isNetworkError && (
                            <Button 
                              size="small" 
                              onClick={performLogin}
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
                        disabled={loading}
                        aria-label="Log In"
                      >
                        {loading ? <CircularProgress size={24} color="inherit" /> : "Log In"}
                      </Button>
                    </motion.div>

                    <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        fullWidth
                        variant="outlined"
                        sx={{ mt: 2 }}
                        onClick={() => handleSocialLogin("discord")}
                        disabled={loading}
                        startIcon={<DiscordIcon sx={{ color: "#96ff9b" }} />}
                        aria-label="Login with Discord"
                      >
                        Log In with Discord
                      </Button>
                    </motion.div>
                  </form>

                  <motion.div variants={itemVariants}>
                    <Typography variant="body2" sx={{ mt: 2, textAlign: "center", color: "text.secondary" }}>
                    Don&apos;t have an account?{" "}
                      <Link href="/register" underline="hover" sx={{ color: "primary.main", cursor: "pointer" }}>Register</Link>
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