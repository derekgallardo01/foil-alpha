"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
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
  SvgIcon,
  Checkbox,
} from "@mui/material";
import { IconButton, InputAdornment } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import Image from "next/image";
import GoogleIcon from "@mui/icons-material/Google";

// Custom Discord Icon using SVG path
function DiscordIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0745.037c-.211.3753-.5437 1.026-.8382 1.5152a18.8438 18.8438 0 00-5.6354 0c-.2937-.489-.627 1.14-.8382-1.5152a.0741.0741 0 00-.0745-.037 19.7859 19.7859 0 00-4.8851 1.5152.0695.0695 0 00-.0321.0277C.5332 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561 19.9342 19.9342 0 005.9909 3.0287.077.077 0 00.0806-.0238c.461-.6897.947-1.4188 1.3307-2.1466a.0732.0732 0 00-.0414-.1054 13.0325 13.0325 0 01-1.8726-.8922.0761.0761 0 01-.023-.0493.0779.0779 0 01.0372-.064c.1266-.0507.399-.2002.7495-.367a.0722.0722 0 01.0738.0138c3.9768 1.816 8.279 1.816 12.2192 0a.0726.0726 0 01.0738-.0138c.3505.1668.6229.3163.7495.367a.0779.0779 0 01.0372.064.0761.0761 0 01-.023.0493 13.0325 13.0325 0 01-1.8726.8922.0732.0732 0 00-.0414.1054c.3837.7278.8697 1.4569 1.3307 2.1466a.077.077 0 00.0806.0238 19.9342 19.9342 0 005.9909-3.0287.0824.0824 0 00.0312-.0561c.4438-4.7216-.3742-9.2109-2.8419-13.6881a.0695.0695 0 00-.0321-.0277zM8.0247 15.3865c-1.203 0-2.1908-1.089-2.1908-2.4317s.9758-2.4317 2.1908-2.4317 2.1908 1.089 2.1908 2.4317-1.008 2.4317-2.1908 2.4317zm7.9506 0c-1.203 0-2.1908-1.089-2.1908-2.4317s.9758-2.4317 2.1908-2.4317 2.1908 1.089 2.1908 2.4317-1.008 2.4317-2.1908 2.4317z" />
    </SvgIcon>
  );
}


export default function LoginClient() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    // Sanitize inputs
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedPassword = password.trim();
    
    console.log("Form data:", { email: sanitizedEmail, password: sanitizedPassword }); // Log sanitized data
    
    // Validate sanitized inputs
    if (!sanitizedEmail || !sanitizedPassword) {
      setError("Both email and password are required.");
      return;
    }
    
    setLoading(true);
    const result = await signIn("credentials", {
      redirect: false,
      email: sanitizedEmail, // Use sanitized email
      password: sanitizedPassword, // Use sanitized password
    });
    setLoading(false);
    
    if (result?.ok) {
      router.push("/dashboard");
    } else {
      setError("Invalid email or password.");
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
        bgcolor: "background.default", // Dark theme background
        p: 3,
      }}
    >
      <Container maxWidth="sm">
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
        <Image
          src="https://i.ibb.co/ZBphxdZ/TCG-Market.png"
          alt="TCG Market Logo"
          width={200} // Set actual width
          height={100} // Set actual height
          style={{ maxWidth: "50%", height: "auto" }}
        />
        </Box>
        <Box sx={{ width: "100%" }}>
            <Typography variant="h4" sx={{ mb: 3, textAlign: "center", color: "text.primary" }}>
            User Login
            </Typography>
            <Typography variant="subtitle1" sx={{ textAlign: "center", color: "text.secondary" }}>
            Access your TCG Market account
          </Typography>
            <form onSubmit={handleLogin}>
            <TextField autoFocus
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
            />
              <TextField
              label="Password"
              type={showPassword ? "text" : "password"} // Toggle between text and password
              fullWidth
              required
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              variant="outlined"
              InputLabelProps={{ style: { color: "text.secondary" } }}
              sx={{ input: { color: "text.primary" } }}
              disabled={loading}
              InputProps={{ // Add InputProps for the toggle button
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      disabled={loading} // Match the disabled state of the TextField
                      sx={{ color: "text.secondary" }} // Optional: match your theme
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {/* Add Remember Me Checkbox Here */}
            <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
              <Checkbox
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                sx={{ color: "text.secondary" }}
                disabled={loading} // Optional: disable during loading
              />
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Remember Me
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ mt: 1, textAlign: "center" }}>
                <Link href="/forgot-password" underline="hover" sx={{ color: "primary.main" }}>
                Forgot Password?
                </Link>
            </Typography>
            {error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}
            <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, bgcolor: "#96ff9b", color: "grey.900" }}
                disabled={loading}
            >
                {loading ? <CircularProgress size={24} color="inherit" /> : "Log In"}
            </Button>
            <Button
                fullWidth
                variant="outlined"
                sx={{ mt: 2 }}
                onClick={() => signIn("discord", { callbackUrl: "/dashboard" })}
                disabled={loading}
                startIcon={<DiscordIcon  sx={{ color: "#96ff9b" }}  />}
            >
                Log In with Discord
            </Button>
            <Button
              fullWidth
              variant="outlined"
              sx={{ mt: 2 }} // Consistent spacing with Discord button
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              disabled={loading} // Match loading state
              startIcon={<GoogleIcon sx={{ color: "#96ff9b" }} />} // Match color with Discord
            >
              Log In with Google
            </Button>
            </form>
            <Typography variant="body2" sx={{ mt: 2, textAlign: "center", color: "text.secondary" }}>
            Don&apos;t have an account?{" "}
            <Link href="/register" underline="hover" sx={{ color: "primary.main", cursor: "pointer" }}>
                Register
            </Link>
            </Typography>
        </Box>
        </Paper>
      </Container>
    </Box>
  );
}