
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Link,
  Backdrop,
  Chip,
  Tooltip,
} from "@mui/material";
import { motion, useInView } from "framer-motion";
import Wordmark from "../components/Wordmark";
import { toast } from "react-toastify";

// Reusable AnimatedCard component
interface AnimatedCardProps {
  children: React.ReactNode;
  delay?: number;
}

const AnimatedCard = ({ children, delay = 0 }: AnimatedCardProps) => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
};

// Variants for animations
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const bounceVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 15 } },
};

interface FormData {
  name: string;
  email: string;
  phone_number?: string;
}

export default function WaitlistPage() {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone_number: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [discordMembers, setDiscordMembers] = useState(5000);
  const [discordOnline, setDiscordOnline] = useState(120);

  // Countdown timer logic
  useEffect(() => {
    const targetDate = new Date("2025-06-30T00:00:00-04:00");
    const updateCountdown = () => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();
      if (difference <= 0) {
        setCountdown("Drop is live!");
        return;
      }
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Discord stats simulation
  useEffect(() => {
    const updateDiscordStats = () => {
      setDiscordMembers((prev) => prev + Math.floor(Math.random() * 5));
      setDiscordOnline((prev) => {
        const newOnline = prev + Math.floor(Math.random() * 3) - 1;
        return Math.max(0, Math.min(newOnline, discordMembers));
      });
    };
    const interval = setInterval(updateDiscordStats, 30000);
    return () => clearInterval(interval);
  }, [discordMembers]);

  const validateEmail = useCallback((email: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }, []);

  const validatePhoneNumber = useCallback((phone: string): boolean => {
    if (!phone) return true; // Phone number is optional
    const re = /^\+?[1-9]\d{1,14}$/;
    return re.test(phone);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    // Client-side validation
    if (!formData.name.trim()) {
      toast.error("Please enter your full name", { position: "top-right" });
      setLoading(false);
      return;
    }
    if (!validateEmail(formData.email)) {
      toast.error("Please enter a valid email address", { position: "top-right" });
      setLoading(false);
      return;
    }
    if (!validatePhoneNumber(formData.phone_number || "")) {
      toast.error("Please enter a valid phone number in E.164 format (e.g., +12345678900)", {
        position: "top-right",
      });
      setLoading(false);
      return;
    }

    try {
      const submittedEmail = formData.email; // Store email before resetting form
      console.log("[Client] Starting waitlist submission for:", submittedEmail);
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone_number: formData.phone_number || undefined,
          emailData: {
            subject: "Welcome to Foil Alpha! Your Waitlist Confirmation",
            body: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <img src="https://iili.io/FHEvIbS.png" 
                       alt="Foil Alpha Logo" 
                       style="width: 200px; height: 100px;" />
                </div>
                <p style="color:rgb(0, 0, 0); margin-bottom: 20px;">
                  Dear ${formData.name},<br><br>
                  Thank you for joining our waitlist! We’re thrilled to have you on board as we prepare to revolutionize Pokémon trading.<br><br>
                  ${
                    formData.phone_number
                      ? `We’ve noted your phone number (${formData.phone_number}) for additional updates.<br><br>`
                      : ""
                  }
                  <strong>What’s Next?</strong><br>
                  1. Stay tuned for exclusive early access updates<br>
                  2. Follow us on Discord for community insights<br>
                  3. Get ready for our launch in June 2026<br><br>
                  
                  We’ll keep you updated on our progress and notify you when your access is ready.<br><br>
                  
                  Best regards,<br>
                  The Foil Alpha Team
                </p>
              </div>
            `,
          },
        }),
      });

      console.log("[Client] API response received");
      const data = await response.json();

      if (!response.ok) {
        console.error("[Client] API request failed:", data.error || "Failed to subscribe");
        throw new Error(data.error || "Failed to subscribe");
      }

      setSuccess(true);
      setFormData({ name: "", email: "", phone_number: "" });
      toast.success("Successfully joined the waitlist!", { position: "top-right" });
      console.log("[Client] Waitlist submission successful for:", submittedEmail);
      setTimeout(() => {
        setSuccess(false);
      }, 5000);
    } catch (error: unknown) {
      console.error("[Client] Error submitting form:", error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      toast.error(errorMessage, { position: "top-right" });
    } finally {
      console.log("[Client] Waitlist submission process completed");
      setLoading(false);
    }
  };

  return (
    <>
      <Backdrop sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }} open={loading}>
        <CircularProgress color="inherit" />
      </Backdrop>
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
          animation: "gradientShift 15s ease infinite",
          "@keyframes gradientShift": {
            "0%": { backgroundPosition: "0% 0%" },
            "50%": { backgroundPosition: "100% 100%" },
            "100%": { backgroundPosition: "0% 0%" },
          },
          "&:before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background:
              "radial-gradient(circle, rgba(155, 92, 255, 0.1) 1px, transparent 1px), radial-gradient(circle, rgba(239, 83, 80, 0.2) 2px, transparent 2px)",
            backgroundSize: "20px 20px, 30px 30px",
            backgroundPosition: "0 0, 15px 15px",
            opacity: 0.3,
            animation: "particleShift 30s linear infinite",
          },
          "@keyframes particleShift": {
            "0%": { backgroundPosition: "0 0, 15px 15px" },
            "100%": { backgroundPosition: "100px 100px, 115px 115px" },
          },
          "@media (prefers-reduced-motion: reduce)": {
            animation: "none",
            "&:before": {
              animation: "none",
            },
          },
        }}
      >
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
                  position: "relative",
                  "&:before": {
                    content: '""',
                    position: "absolute",
                    top: -10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background:
                      "radial-gradient(circle, #fff 40%, red.500 40%, red.500 60%, grey.900 60%, grey.900 70%, grey.50 70%)",
                    boxShadow: "0 0 5px rgba(239, 83, 80, 0.3)",
                  },
                }}
              >
                <Box sx={{ mb: 2, display: "flex", justifyContent: "center" }}>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  >
                    <Wordmark size={40} />
                  </motion.div>
                </Box>
                <Box sx={{ width: "100%" }}>
                  <Typography
                    variant="h5"
                    sx={{
                      textAlign: "center",
                      color: "#9B5Cff",
                      mb: 1,
                      fontWeight: "bold",
                      textShadow: "0 0 10px rgba(155, 92, 255, 0.5)",
                      "@media (prefers-reduced-motion: reduce)": {
                        textShadow: "none",
                      },
                    }}
                  >
                    Unlock the Future of Pokémon Trading!
                  </Typography>
                  <Typography variant="h4" sx={{ mb: 1, textAlign: "center", color: "text.primary" }}>
                    Join the Waitlist
                  </Typography>
                  <Typography variant="subtitle1" sx={{ textAlign: "center", color: "grey.400", mb: 3 }}>
                    Be the first to experience cutting-edge market insights
                  </Typography>

                  <motion.div variants={containerVariants} initial="hidden" animate="visible">
                    <form onSubmit={handleSubmit} aria-label="Join Waitlist Form">
                      <motion.div variants={bounceVariants}>
                        <TextField
                          label="Full Name"
                          type="text"
                          fullWidth
                          required
                          margin="normal"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          variant="outlined"
                          InputLabelProps={{ style: { color: "grey.400" } }}
                          sx={{
                            input: { color: "text.primary" },
                            "& .MuiOutlinedInput-root": {
                              "& fieldset": {
                                borderColor: "rgba(255, 255, 255, 0.2)",
                              },
                              "&:hover fieldset": {
                                borderColor: "rgba(255, 255, 255, 0.4)",
                                boxShadow: "0 0 8px rgba(155, 92, 255, 0.3)",
                              },
                              "&.Mui-focused fieldset": {
                                borderColor: "blue.500",
                                boxShadow: "0 0 12px rgba(155, 92, 255, 0.5)",
                              },
                            },
                          }}
                          inputProps={{ "aria-label": "Full Name" }}
                        />
                      </motion.div>
                      <motion.div variants={bounceVariants}>
                        <TextField
                          label="Email Address"
                          type="email"
                          fullWidth
                          required
                          margin="normal"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          variant="outlined"
                          InputLabelProps={{ style: { color: "grey.400" } }}
                          sx={{
                            input: { color: "text.primary" },
                            "& .MuiOutlinedInput-root": {
                              "& fieldset": {
                                borderColor: "rgba(255, 255, 255, 0.2)",
                              },
                              "&:hover fieldset": {
                                borderColor: "rgba(255, 255, 255, 0.4)",
                                boxShadow: "0 0 8px rgba(155, 92, 255, 0.3)",
                              },
                              "&.Mui-focused fieldset": {
                                borderColor: "blue.500",
                                boxShadow: "0 0 12px rgba(155, 92, 255, 0.5)",
                              },
                            },
                          }}
                          inputProps={{ "aria-label": "Email Address" }}
                        />
                      </motion.div>
                      <motion.div variants={bounceVariants}>
                        <TextField
                          label="Phone Number (Optional)"
                          type="tel"
                          fullWidth
                          margin="normal"
                          value={formData.phone_number || ""}
                          onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                          variant="outlined"
                          InputLabelProps={{ style: { color: "grey.400" } }}
                          sx={{
                            input: { color: "text.primary" },
                            "& .MuiOutlinedInput-root": {
                              "& fieldset": {
                                borderColor: "rgba(255, 255, 255, 0.2)",
                              },
                              "&:hover fieldset": {
                                borderColor: "rgba(255, 255, 255, 0.4)",
                                boxShadow: "0 0 8px rgba(155, 92, 255, 0.3)",
                              },
                              "&.Mui-focused fieldset": {
                                borderColor: "blue.500",
                                boxShadow: "0 0 12px rgba(155, 92, 255, 0.5)",
                              },
                            },
                          }}
                          inputProps={{ "aria-label": "Phone Number" }}
                          helperText="e.g., +12345678900"
                        />
                      </motion.div>
                      <motion.div variants={bounceVariants}>
                        <Button
                          type="submit"
                          disabled={loading}
                          fullWidth
                          variant="contained"
                          color="primary"
                          size="large"
                          sx={{
                            bgcolor: "blue.600",
                            "&:hover": {
                              bgcolor: "blue.700",
                              boxShadow: "0 0 15px rgba(155, 92, 255, 0.5)",
                              transform: "scale(1.02)",
                              transition: "all 0.3s ease",
                            },
                            "&:disabled": {
                              opacity: 0.5,
                            },
                            px: 4,
                            py: 2,
                            position: "relative",
                            overflow: "hidden",
                            "&:before": {
                              content: '""',
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "100%",
                              height: "100%",
                              background: "radial-gradient(circle, rgba(155, 92, 255, 0.3) 0%, transparent 70%)",
                              opacity: 0,
                              transition: "opacity 0.3s ease",
                            },
                            "&:hover:before": {
                              opacity: 1,
                            },
                          }}
                          aria-label="Join Waitlist"
                        >
                          {loading ? (
                            <>
                              <CircularProgress size={24} color="inherit" />
                              <span style={{ marginLeft: 8 }}>Submitting...</span>
                            </>
                          ) : (
                            "Join Waitlist"
                          )}
                        </Button>
                      </motion.div>
                      {success && (
                        <motion.div
                          variants={itemVariants}
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: "spring", stiffness: 200, damping: 10 }}
                        >
                          <Typography
                            variant="body1"
                            sx={{
                              textAlign: "center",
                              color: "white",
                              mt: 2,
                              p: 2,
                              bgcolor: "success.light",
                              borderRadius: 1,
                              position: "relative",
                              overflow: "hidden",
                              "&:before": {
                                content: '""',
                                position: "absolute",
                                top: "-50%",
                                left: "-50%",
                                width: "200%",
                                height: "200%",
                                background: "radial-gradient(circle, rgba(155, 92, 255, 0.5) 0%, transparent 70%)",
                                animation: "confetti 1s ease-out",
                              },
                              "@keyframes confetti": {
                                "0%": { transform: "scale(0)", opacity: 1 },
                                "100%": { transform: "scale(1)", opacity: 0 },
                              },
                              "@media (prefers-reduced-motion: reduce)": {
                                "&:before": {
                                  animation: "none",
                                },
                              },
                            }}
                          >
                            Thank you! You’ve been added to the waitlist.
                          </Typography>
                        </motion.div>
                      )}
                      {!success && (
                        <Box sx={{ textAlign: "center", mt: 2 }}>
                          <Typography
                            variant="h6"
                            sx={{
                              color: "#9B5Cff",
                              fontWeight: "bold",
                              textShadow: "0 0 10px rgba(155, 92, 255, 0.5)",
                              "@media (prefers-reduced-motion: reduce)": {
                                textShadow: "none",
                              },
                            }}
                          >
                            Join 5,000+ others on the waitlist!
                          </Typography>
                          <Typography variant="body2" sx={{ color: "grey.400", mt: 1 }}>
                            Don’t miss out—be part of the future of Pokémon trading!
                          </Typography>
                          <Typography variant="body2" sx={{ color: "grey.400", mt: 1 }}>
                            Join our community of {discordMembers} members, with {discordOnline} online now!
                          </Typography>
                          <Box sx={{ display: "flex", gap: 2, mt: 2, justifyContent: "center" }}>
                            <Typography
                              variant="body2"
                              sx={{
                                mt: 1,
                                fontWeight: "bold",
                                letterSpacing: "0.05em",
                                color: "#9B5Cff",
                                display: "inline-block",
                                px: 2,
                                py: 1,
                                borderRadius: "12px",
                                bgcolor: "grey.800",
                                boxShadow: "0 0 5px rgba(155, 92, 255, 0.3)",
                                border: "1px solid rgba(155, 92, 255, 0.3)",
                                animation: "pulse 2s ease-in-out infinite",
                                "@keyframes pulse": {
                                  "0%": { transform: "scale(1)", boxShadow: "0 0 5px rgba(155, 92, 255, 0.3)" },
                                  "50%": { transform: "scale(1.02)", boxShadow: "0 0 10px rgba(155, 92, 255, 0.5)" },
                                  "100%": { transform: "scale(1)", boxShadow: "0 0 5px rgba(155, 92, 255, 0.3)" },
                                },
                                "@media (prefers-reduced-motion: reduce)": {
                                  animation: "none",
                                  boxShadow: "none",
                                },
                              }}
                            >
                              Next Pokémon drop in: {countdown}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </form>
                  </motion.div>
                </Box>
              </Paper>
            </motion.div>
          </motion.div>
        </Container>

        <Container maxWidth="sm" sx={{ mt: 8, mb: 8 }}>
          <div>
            {/* Feature 1: Smart Market Insights */}
            <AnimatedCard delay={0.1}>
              <Paper
                elevation={6}
                sx={{
                  p: 4,
                  bgcolor: "grey.900",
                  backgroundImage: "linear-gradient(#000000, rgba(0, 0, 0, 0))",
                  borderRadius: 2,
                  boxShadow: "0 0 10px rgba(155, 92, 255, 0.21)",
                  mb: 4,
                  transition: "all 0.3s ease",
                  "&:hover": {
                    transform: "translateY(-5px)",
                    boxShadow: "0 0 20px rgba(155, 92, 255, 0.5)",
                  },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "flex-start", color: "text.primary" }}>
                  <Box
                    sx={{
                      width: { xs: "2rem", sm: "2.5rem" },
                      height: { xs: "2rem", sm: "2.5rem" },
                      borderRadius: "50%",
                      bgcolor: "grey.700",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      mr: { xs: 1, sm: 2 },
                      fontSize: { xs: "1rem", sm: "1.5rem" },
                      fontWeight: "bold",
                      color: "white",
                      flexShrink: 0,
                    }}
                  >
                    1
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: "bold",
                        fontSize: { xs: "1.25rem", sm: "1.5rem" },
                        mb: 1,
                      }}
                    >
                      Smart Market Insights
                    </Typography>
                    <Typography
                      sx={{
                        color: "grey.400",
                        fontSize: { xs: "0.875rem", sm: "1rem" },
                        lineHeight: 1.5,
                        mb: 2,
                      }}
                    >
                      AI-powered price predictions and market trends analysis with real-time data
                    </Typography>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "center",
                        width: "100%",
                        mt: 2,
                      }}
                    >
                      <svg
                        width="140"
                        height="90"
                        viewBox="0 0 140 90"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{ maxWidth: "100%", height: "auto" }}
                      >
                        <g opacity="0.1">
                          <line x1="10" y1="20" x2="130" y2="20" stroke="#9B5Cff" strokeWidth="0.5" />
                          <line x1="10" y1="40" x2="130" y2="40" stroke="#9B5Cff" strokeWidth="0.5" />
                          <line x1="10" y1="60" x2="130" y2="60" stroke="#9B5Cff" strokeWidth="0.5" />
                          <line x1="30" y1="0" x2="30" y2="80" stroke="#9B5Cff" strokeWidth="0.5" />
                          <line x1="70" y1="0" x2="70" y2="80" stroke="#9B5Cff" strokeWidth="0.5" />
                          <line x1="110" y1="0" x2="110" y2="80" stroke="#9B5Cff" strokeWidth="0.5" />
                        </g>
                        <defs>
                          <linearGradient
                            id="lineGradient"
                            x1="10"
                            y1="70"
                            x2="130"
                            y2="30"
                            gradientUnits="userSpaceOnUse"
                          >
                            <stop offset="0%" stopColor="#9B5Cff" stopOpacity="0.3" />
                            <stop offset="50%" stopColor="#9B5Cff" stopOpacity="1" />
                            <stop offset="100%" stopColor="#9B5Cff" stopOpacity="0.3" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M10 70 L30 50 L50 60 L70 40 L90 50 L110 30 L130 50"
                          stroke="url(#lineGradient)"
                          strokeWidth="2"
                          filter="url(#glow)"
                        >
                          <animate
                            attributeName="stroke-opacity"
                            values="1;0.5;1"
                            dur="2s"
                            repeatCount="indefinite"
                          />
                        </path>
                        <defs>
                          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        <circle cx="10" cy="70" r="3" fill="#9B5Cff" filter="url(#glow)" />
                        <circle cx="30" cy="50" r="3" fill="#9B5Cff" filter="url(#glow)" />
                        <circle cx="50" cy="60" r="3" fill="#9B5Cff" filter="url(#glow)" />
                        <circle cx="70" cy="40" r="3" fill="#9B5Cff" filter="url(#glow)" />
                        <circle cx="90" cy="50" r="3" fill="#9B5Cff" filter="url(#glow)" />
                        <circle cx="110" cy="30" r="3" fill="#9B5Cff" filter="url(#glow)" />
                        <circle cx="130" cy="50" r="3" fill="#9B5Cff" filter="url(#glow)" />
                      </svg>
                    </Box>
                  </Box>
                </Box>
              </Paper>
            </AnimatedCard>

            {/* Feature 2: Real-Time Alerts with Pokémon-Themed Graphic */}
            <AnimatedCard delay={0.2}>
              <Paper
                elevation={6}
                sx={{
                  p: 4,
                  bgcolor: "grey.900",
                  backgroundImage: "linear-gradient(#000000, rgba(0, 0, 0, 0))",
                  borderRadius: 2,
                  boxShadow: "0 0 10px rgba(155, 92, 255, 0.21)",
                  mb: 4,
                  transition: "all 0.3s ease",
                  "&:hover": {
                    transform: "translateY(-5px)",
                    boxShadow: "0 0 20px rgba(155, 92, 255, 0.5)",
                  },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "flex-start", color: "text.primary" }}>
                  <Box
                    sx={{
                      width: { xs: "2rem", sm: "2.5rem" },
                      height: { xs: "2rem", sm: "2.5rem" },
                      borderRadius: "50%",
                      bgcolor: "grey.700",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      mr: { xs: 1, sm: 2 },
                      fontSize: { xs: "1rem", sm: "1.5rem" },
                      fontWeight: "bold",
                      color: "white",
                      flexShrink: 0,
                    }}
                  >
                    2
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: "bold",
                        fontSize: { xs: "1.25rem", sm: "1.5rem" },
                        mb: 1,
                      }}
                    >
                      Real-Time Alerts
                    </Typography>
                    <Typography
                      sx={{
                        color: "grey.400",
                        fontSize: { xs: "0.875rem", sm: "1rem" },
                        lineHeight: 1.5,
                        mb: 2,
                      }}
                    >
                      Instant notifications for price drops, new releases, and market trends
                    </Typography>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "center",
                        width: "100%",
                        mt: 2,
                      }}
                    >
                      <svg
                        width="100"
                        height="100"
                        viewBox="0 0 100 100"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{ maxWidth: "100%", height: "auto" }}
                      >
                        <circle cx="50" cy="50" r="40" fill="url(#pokeBallGradient)" filter="url(#glow)" />
                        <defs>
                          <linearGradient
                            id="pokeBallGradient"
                            x1="50"
                            y1="10"
                            x2="50"
                            y2="90"
                            gradientUnits="userSpaceOnUse"
                          >
                            <stop offset="0%" stopColor="#ff0000" />
                            <stop offset="48%" stopColor="#ff0000" />
                            <stop offset="50%" stopColor="#000" />
                            <stop offset="52%" stopColor="#fff" />
                            <stop offset="100%" stopColor="#fff" />
                          </linearGradient>
                        </defs>
                        <circle cx="50" cy="50" r="10" fill="#fff" stroke="#000" strokeWidth="2" filter="url(#glow)" />
                        <path
                          d="M50 35 V50 M50 55 V60"
                          stroke="#9B5Cff"
                          strokeWidth="3"
                          strokeLinecap="round"
                          filter="url(#glow)"
                        />
                        <g opacity="0.8">
                          <path
                            d="M30 20 A30 30 0 0 1 40 10"
                            stroke="#9B5Cff"
                            strokeWidth="1"
                            filter="url(#glow)"
                          >
                            <animate
                              attributeName="opacity"
                              values="0.8;0.4;0.8"
                              dur="1.5s"
                              repeatCount="indefinite"
                            />
                          </path>
                          <path
                            d="M70 80 A30 30 0 0 0 60 90"
                            stroke="#9B5Cff"
                            strokeWidth="1"
                            filter="url(#glow)"
                          >
                            <animate
                              attributeName="opacity"
                              values="0.8;0.4;0.8"
                              dur="1.5s"
                              repeatCount="indefinite"
                            />
                          </path>
                        </g>
                        <defs>
                          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                      </svg>
                    </Box>
                  </Box>
                </Box>
              </Paper>
            </AnimatedCard>

            {/* Feature 3: Community Market Insights */}
            <AnimatedCard delay={0.3}>
              <Paper
                elevation={6}
                sx={{
                  p: 4,
                  bgcolor: "grey.900",
                  backgroundImage: "linear-gradient(#000000, rgba(0, 0, 0, 0))",
                  borderRadius: 2,
                  boxShadow: "0 0 10px rgba(155, 92, 255, 0.21)",
                  mb: 4,
                  transition: "all 0.3s ease",
                  "&:hover": {
                    transform: "translateY(-5px)",
                    boxShadow: "0 0 20px rgba(155, 92, 255, 0.5)",
                  },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "flex-start", color: "text.primary" }}>
                  <Box
                    sx={{
                      width: { xs: "2rem", sm: "2.5rem" },
                      height: { xs: "2rem", sm: "2.5rem" },
                      borderRadius: "50%",
                      bgcolor: "grey.700",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      mr: { xs: 1, sm: 2 },
                      fontSize: { xs: "1rem", sm: "1.5rem" },
                      fontWeight: "bold",
                      color: "white",
                      flexShrink: 0,
                    }}
                  >
                    3
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: "bold",
                        fontSize: { xs: "1.25rem", sm: "1.5rem" },
                        mb: 1,
                      }}
                    >
                      Community Market Insights
                    </Typography>
                    <Typography
                      sx={{
                        color: "grey.400",
                        fontSize: { xs: "0.875rem", sm: "1rem" },
                        lineHeight: 1.5,
                        mb: 2,
                      }}
                    >
                      Get real-time market insights from our active community of traders and collectors. Join
                      discussions, share tips, and stay informed
                    </Typography>
                    <Box sx={{ display: "flex", gap: 2, alignItems: "center", mt: 2 }}>
                      <Tooltip title="Active Channels">
                        <Chip
                          label="#market-insights"
                          variant="outlined"
                          size="small"
                          sx={{
                            bgcolor: "rgba(155, 92, 255, 0.1)",
                            color: "success.main",
                            borderColor: "rgba(155, 92, 255, 0.2)",
                          }}
                        />
                      </Tooltip>
                      <Tooltip title="Trading Volume">
                        <Chip
                          label="Daily Volume"
                          variant="outlined"
                          size="small"
                          sx={{
                            bgcolor: "rgba(155, 92, 255, 0.1)",
                            color: "success.main",
                            borderColor: "rgba(155, 92, 255, 0.2)",
                          }}
                        />
                      </Tooltip>
                    </Box>
                  </Box>
                </Box>
              </Paper>
            </AnimatedCard>

            {/* Feature 4: Discord Bot Integration */}
            <AnimatedCard delay={0.4}>
              <Paper
                elevation={6}
                sx={{
                  p: 4,
                  bgcolor: "grey.900",
                  backgroundImage: "linear-gradient(#000000, rgba(0, 0, 0, 0))",
                  borderRadius: 2,
                  boxShadow: "0 0 10px rgba(155, 92, 255, 0.21)",
                  mb: 4,
                  transition: "all 0.3s ease",
                  "&:hover": {
                    transform: "translateY(-5px)",
                    boxShadow: "0 0 20px rgba(155, 92, 255, 0.5)",
                  },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "flex-start", color: "text.primary" }}>
                  <Box
                    sx={{
                      width: { xs: "2rem", sm: "2.5rem" },
                      height: { xs: "2rem", sm: "2.5rem" },
                      borderRadius: "50%",
                      bgcolor: "grey.700",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      mr: { xs: 1, sm: 2 },
                      fontSize: { xs: "1rem", sm: "1.5rem" },
                      fontWeight: "bold",
                      color: "white",
                      flexShrink: 0,
                    }}
                  >
                    4
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: "bold",
                        fontSize: { xs: "1.25rem", sm: "1.5rem" },
                        mb: 1,
                      }}
                    >
                      Discord Bot Integration
                    </Typography>
                    <Typography
                      sx={{
                        color: "grey.400",
                        fontSize: { xs: "0.875rem", sm: "1rem" },
                        lineHeight: 1.5,
                        mb: 2,
                      }}
                    >
                      Get instant price alerts, market trends, and trading insights directly in our Discord
                      server
                    </Typography>
                    <Box sx={{ display: "flex", gap: 2, alignItems: "center", mt: 2 }}>
                      <Tooltip title="Bot Features">
                        <Chip
                          label="Price Alerts"
                          variant="outlined"
                          size="small"
                          sx={{
                            bgcolor: "rgba(155, 92, 255, 0.1)",
                            color: "success.main",
                            borderColor: "rgba(155, 92, 255, 0.2)",
                          }}
                        />
                      </Tooltip>
                      <Tooltip title="Market Data">
                        <Chip
                          label="Market Stats"
                          variant="outlined"
                          size="small"
                          sx={{
                            bgcolor: "rgba(155, 92, 255, 0.1)",
                            color: "success.main",
                            borderColor: "rgba(155, 92, 255, 0.2)",
                          }}
                        />
                      </Tooltip>
                    </Box>
                  </Box>
                </Box>
              </Paper>
            </AnimatedCard>
          </div>
        </Container>

        {/* Footer Section */}
        <Box sx={{ textAlign: "center", py: 2, bgcolor: "grey.800", width: "100%", mt: "auto" }}>
          <Typography variant="body2" sx={{ color: "grey.400" }}>
            2025 Foil Alpha. All rights reserved.{" "}
            <Link
              href="/privacy"
              sx={{ color: "#9B5Cff", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
            >
              Privacy Policy
            </Link>{" "}
            |{" "}
            <Link
              href="/about"
              sx={{ color: "#9B5Cff", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
            >
              Learn More
            </Link>
          </Typography>
        </Box>
      </Box>
    </>
  );
}
