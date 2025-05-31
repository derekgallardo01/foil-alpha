"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Backdrop,
} from "@mui/material";
import Image from "next/image";
import { motion } from "framer-motion";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export default function LandingPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to subscribe");
      }

      await response.json();
      setSuccess(true);
      setFormData({ name: "", email: "" });
      setTimeout(() => {
        router.push("/");
      }, 3000);
    } catch (error) {
      console.error("Error submitting form:", error);
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
        bgcolor: "grey.900",
        p: 3,
        position: "relative",
        background: "linear-gradient(181deg, #000000bd, #031e04, #0000002b, #000000d4)",
        backgroundSize: "200% 200%",
        animation: {
          gradientShift: {
            "0%": { backgroundPosition: "0% 0%" },
            "50%": { backgroundPosition: "100% 100%" },
            "100%": { backgroundPosition: "0% 0%" },
          },
        },
      }}
    >
      <ToastContainer position="top-right" />
      <Backdrop sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }} open={loading}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <Container maxWidth="sm" sx={{ position: "relative", zIndex: 1 }}>
        <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
          <motion.div initial={{ rotateY: 180 }} animate={{ rotateY: 0 }} transition={{ duration: 0.6 }}>
            <Paper
              elevation={6}
              sx={{
                p: 4,
                bgcolor: "grey.900",
                backgroundImage: "linear-gradient(#000000, rgba(0, 0, 0, 0))",
                borderRadius: 2,
                boxShadow: "0 0 10px rgba(150, 255, 155, 0.21)",
              }}
            >
              <Box sx={{ mb: 2, display: "flex", justifyContent: "center" }}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
                  <Image src="https://i.ibb.co/ZBphxdZ/TCG-Market.png" alt="TCG Market Logo" width={200} height={100} priority />
                </motion.div>
              </Box>
              <Box sx={{ width: "100%" }}>
                <Typography variant="h4" sx={{ mb: 3, textAlign: "center", color: "text.primary" }}>
                  Join the Waitlist
                </Typography>
                <Typography variant="subtitle1" sx={{ textAlign: "center", color: "text.secondary" }}>
                  Be the first to know when we launch
                </Typography>

                <motion.div variants={containerVariants} initial="hidden" animate="visible">
                  <form onSubmit={handleSubmit}>
                    <motion.div variants={itemVariants}>
                      <TextField
                        label="Full Name"
                        type="text"
                        fullWidth
                        required
                        margin="normal"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        variant="outlined"
                        InputLabelProps={{ style: { color: "text.secondary" } }}
                        sx={{
                          input: { color: "text.primary" },
                          "& .MuiOutlinedInput-root": {
                            "& fieldset": {
                              borderColor: "rgba(255, 255, 255, 0.2)",
                            },
                            "&:hover fieldset": {
                              borderColor: "rgba(255, 255, 255, 0.4)",
                            },
                            "&.Mui-focused fieldset": {
                              borderColor: "blue.500",
                            },
                          },
                        }}
                      />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                      <TextField
                        label="Email Address"
                        type="email"
                        fullWidth
                        required
                        margin="normal"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        variant="outlined"
                        InputLabelProps={{ style: { color: "text.secondary" } }}
                        sx={{
                          input: { color: "text.primary" },
                          "& .MuiOutlinedInput-root": {
                            "& fieldset": {
                              borderColor: "rgba(255, 255, 255, 0.2)",
                            },
                            "&:hover fieldset": {
                              borderColor: "rgba(255, 255, 255, 0.4)",
                            },
                            "&.Mui-focused fieldset": {
                              borderColor: "blue.500",
                            },
                          },
                        }}
                      />
                    </motion.div>
                    <motion.div variants={itemVariants}>
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
                          },
                          "&:disabled": {
                            opacity: 0.5,
                          },
                          px: 4,
                          py: 2,
                        }}
                      >
                        {loading ? (
                          <>
                            <CircularProgress size={24} color="inherit" />
                            Submitting...
                          </>
                        ) : (
                          "Join Waitlist"
                        )}
                      </Button>
                    </motion.div>
                    {success && (
                      <motion.div variants={itemVariants}>
                        <Typography
                          variant="body1"
                          sx={{
                            textAlign: "center",
                            color: "success.main",
                            mt: 2,
                            p: 2,
                            bgcolor: "success.light",
                            borderRadius: 1,
                          }}
                        >
                          Thank you! You've been added to the waitlist.
                        </Typography>
                      </motion.div>
                    )}
                  </form>
                </motion.div>
              </Box>
            </Paper>
          </motion.div>
        </motion.div>
      </Container>

      {/* Updated Features Section with Containers Matching Login Container Size */}
      <Container maxWidth="sm" sx={{ mt: 8, mb: 8 }}>
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          {/* Feature 1 */}
          <motion.div variants={itemVariants}>
            <Paper
              elevation={6}
              sx={{
                p: 4,
                bgcolor: "grey.900",
                backgroundImage: "linear-gradient(#000000, rgba(0, 0, 0, 0))",
                borderRadius: 2,
                boxShadow: "0 0 10px rgba(150, 255, 155, 0.21)",
                mb: 4,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "flex-start", color: "text.primary" }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    bgcolor: "grey.700",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mr: 2,
                    fontSize: "1.5rem",
                    fontWeight: "bold",
                    color: "white",
                  }}
                >
                  1
                </Box>
                <Box>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: "bold",
                      fontSize: "1.5rem",
                      mb: 1,
                    }}
                  >
                    Smart Market Insights
                  </Typography>
                  <Typography
                    sx={{
                      color: "text.secondary",
                      fontSize: "1rem",
                      lineHeight: 1.5,
                    }}
                  >
                    AI-powered price predictions and market trends analysis with real-time data
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </motion.div>

          {/* Feature 2 */}
          <motion.div variants={itemVariants}>
            <Paper
              elevation={6}
              sx={{
                p: 4,
                bgcolor: "grey.900",
                backgroundImage: "linear-gradient(#000000, rgba(0, 0, 0, 0))",
                borderRadius: 2,
                boxShadow: "0 0 10px rgba(150, 255, 155, 0.21)",
                mb: 4,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "flex-start", color: "text.primary" }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    bgcolor: "grey.700",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mr: 2,
                    fontSize: "1.5rem",
                    fontWeight: "bold",
                    color: "white",
                  }}
                >
                  2
                </Box>
                <Box>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: "bold",
                      fontSize: "1.5rem",
                      mb: 1,
                    }}
                  >
                    Real-Time Alerts
                  </Typography>
                  <Typography
                    sx={{
                      color: "text.secondary",
                      fontSize: "1rem",
                      lineHeight: 1.5,
                    }}
                  >
                    Instant notifications for price drops, new releases, and market trends
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </motion.div>
        </motion.div>
      </Container>
    </Box>
  );
}