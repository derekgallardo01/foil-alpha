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
  Grid,
  Card,
  CardContent,
  Alert,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import Image from "next/image";
import { motion } from "framer-motion";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { GoogleAnalytics } from "nextjs-google-analytics";
import SocialLogins from "../components/SocialLogins";

// DEV MODE: Available test users
const DEV_USERS = [
  { email: 'admin@test.com', password: '123', name: 'Admin User', role: 'admin' },
  { email: 'user@test.com', password: 'user123', name: 'Test User', role: 'user' },
  { email: 'user1@test.com', password: 'user123', name: 'Test User 1', role: 'user' },
  { email: 'buyer@test.com', password: 'buyer123', name: 'Buyer User', role: 'user' },
  { email: 'seller@test.com', password: 'seller123', name: 'Seller User', role: 'user' },
];

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

// Simplified validation for dev mode
const validateForm = (email: string, password: string): string | null => {
  if (!email.trim()) return "Email is required";
  if (!password.trim()) return "Password is required";
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
  const [devMode] = useState(process.env.NODE_ENV === 'development');
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

  // DEV MODE: Quick login function
  const quickLogin = async (userEmail: string, userPassword: string, userName: string) => {
    setEmail(userEmail);
    setPassword(userPassword);
    setLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        redirect: false,
        email: userEmail,
        password: userPassword,
      }) as SignInResponse;

      if (result?.ok) {
        toast.success(`Logged in as ${userName}!`, { autoClose: 2000 });
        router.push("/dashboard");
      } else {
        setError(result?.error || 'Login failed');
      }
    } catch {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const performLogin = async () => {
    setError(null);
    setIsNetworkError(false);

    const validationError = validateForm(email, password);
    if (validationError) {
      setError(validationError);
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

  const handleSuccessfulLogin = () => {
    if (rememberMe) {
      localStorage.setItem("rememberedEmail", email.trim().toLowerCase());
      localStorage.setItem("rememberMe", "true");
    } else {
      localStorage.removeItem("rememberedEmail");
      localStorage.removeItem("rememberMe");
    }
    toast.success("Logged in successfully!", { autoClose: 2000 });
    router.push("/dashboard");
  };

  const handleLoginError = (err: AuthError) => {
    let errorMessage = "Invalid email or password";

    if (err.status === 429) {
      errorMessage = "Too many login attempts. Please try again later";
    } else if (!navigator.onLine || err.message.includes("network")) {
      errorMessage = "Network connection lost. Please check your internet";
      setIsNetworkError(true);
    }

    setError(errorMessage);
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

      <Container maxWidth="md" sx={{ position: "relative", zIndex: 1 }}>
        <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
          <motion.div initial={{ rotateY: 180 }} animate={{ rotateY: 0 }} transition={{ duration: 0.6 }}>
            <Paper elevation={6} sx={{ p: 4, bgcolor: "grey.900", backgroundImage: "linear-gradient(#000000, rgba(0, 0, 0, 0))", borderRadius: 2, boxShadow: "0 0 10px rgba(150, 255, 155, 0.21)" }}>
              <Box sx={{ mb: 2, display: "flex", justifyContent: "center" }}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
                  <Image src="https://i.ibb.co/ZBphxdZ/TCG-Market.png" alt="Foil Alpha Logo" width={200} height={100} priority />
                </motion.div>
              </Box>

              {/* DEV MODE: Quick Login Section */}
              {devMode && (
                <motion.div variants={itemVariants}>
                  <Alert severity="info" sx={{ mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      🚧 Development Mode - Quick Login
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      Skip email verification and login instantly with test accounts:
                    </Typography>

                    <Grid container spacing={2}>
                      {DEV_USERS.map((user) => (
                        <Grid item xs={12} sm={6} md={4} key={user.email}>
                          <Card sx={{
                            bgcolor: user.role === 'admin' ? 'error.dark' : 'primary.dark',
                            '&:hover': { bgcolor: user.role === 'admin' ? 'error.main' : 'primary.main' }
                          }}>
                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                              <Typography variant="subtitle2" gutterBottom>
                                {user.name}
                              </Typography>
                              <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                                {user.email}
                              </Typography>
                              <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                                Password: {user.password}
                              </Typography>
                              <Button
                                size="small"
                                variant="contained"
                                fullWidth
                                onClick={() => quickLogin(user.email, user.password, user.name)}
                                disabled={loading}
                                sx={{
                                  bgcolor: user.role === 'admin' ? 'error.light' : 'primary.light',
                                  color: 'white',
                                  '&:hover': { bgcolor: user.role === 'admin' ? 'error.main' : 'primary.main' }
                                }}
                              >
                                Login as {user.role}
                              </Button>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  </Alert>
                </motion.div>
              )}

              <Box sx={{ width: "100%" }}>
                <Typography variant="h4" sx={{ mb: 3, textAlign: "center", color: "text.primary" }}>
                  User Login
                </Typography>
                <Typography variant="subtitle1" sx={{ textAlign: "center", color: "text.secondary" }}>
                  Access your Foil Alpha account
                </Typography>

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
                  </form>

                  <SocialLogins callbackUrl="/dashboard" />

                  <motion.div variants={itemVariants}>
                    <Typography variant="body2" sx={{ mt: 2, textAlign: "center", color: "text.secondary" }}>
                      {"Don't have an account? "}
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