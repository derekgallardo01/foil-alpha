"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Stack,
  Divider,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import {
  Insights,
  QueryStats,
  Storefront,
  ShowChart,
  Bolt,
  VerifiedUser,
  ArrowForward,
} from "@mui/icons-material";
import { motion, useReducedMotion } from "framer-motion";
import GradientHeading from "./components/ui/GradientHeading";

const FEATURES = [
  {
    icon: <ShowChart />,
    title: "Track your portfolio",
    desc: "Every card, sealed box, and graded slab in one place — with a live holdings breakdown and your most valuable items surfaced automatically.",
  },
  {
    icon: <QueryStats />,
    title: "ML price forecasting",
    desc: "Model-driven forecasts on top of real market history, so you can see where a card is heading — not just where it's been.",
  },
  {
    icon: <Storefront />,
    title: "A real marketplace",
    desc: "List, bid, and buy with live auctions and fixed-price sales. Wallet-backed settlement keeps every trade clean.",
  },
  {
    icon: <Insights />,
    title: "Market intelligence",
    desc: "Trending movers, new releases, and popularity signals across the market — updated continuously on your dashboard.",
  },
  {
    icon: <Bolt />,
    title: "Fast, keyboard-first",
    desc: "A calm, data-legible terminal built for scanning thousands of lines. Search, filter, and jump without friction.",
  },
  {
    icon: <VerifiedUser />,
    title: "Yours, secured",
    desc: "Your collection data stays private and portable. Import what you already own and pick up right where you are.",
  },
];

const containerV = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemV = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export default function LandingClient() {
  const { status } = useSession();
  const router = useRouter();
  const reduce = useReducedMotion();

  // Logged-in visitors skip the pitch and go straight to their dashboard.
  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        background: (t) =>
          `radial-gradient(120% 90% at 15% -10%, #17102e 0%, ${t.palette.background.default} 55%)`,
      }}
    >
      {/* Soft holo glow behind the hero */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: -160,
          right: -120,
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: (t) => t.foil.gradientSoft,
          filter: "blur(90px)",
          opacity: 0.7,
          pointerEvents: "none",
        }}
      />

      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
        {/* Top bar */}
        <Box
          component="header"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            py: 2.5,
          }}
        >
          <GradientHeading variant="h5" component="div" sx={{ letterSpacing: "-0.01em" }}>
            Foil Alpha
          </GradientHeading>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button color="inherit" onClick={() => router.push("/login")} sx={{ color: "text.secondary" }}>
              Log in
            </Button>
            <Button variant="contained" color="primary" onClick={() => router.push("/register")}>
              Get started
            </Button>
          </Stack>
        </Box>

        {/* Hero */}
        <Box
          component={motion.div}
          initial={reduce ? false : "hidden"}
          animate="visible"
          variants={containerV}
          sx={{ pt: { xs: 6, md: 12 }, pb: { xs: 8, md: 14 }, textAlign: "center", maxWidth: 820, mx: "auto" }}
        >
          <Box component={motion.div} variants={itemV}>
            <Typography
              variant="overline"
              sx={{ color: "secondary.main", display: "block", mb: 2 }}
            >
              Terminal-grade TCG intelligence
            </Typography>
          </Box>

          <Box component={motion.div} variants={itemV}>
            <GradientHeading
              variant="h2"
              component="h1"
              sx={{ fontSize: { xs: "2.5rem", md: "3.75rem" }, mb: 2.5 }}
            >
              Know what your cards are really worth.
            </GradientHeading>
          </Box>

          <Box component={motion.div} variants={itemV}>
            <Typography
              variant="h6"
              sx={{ color: "text.secondary", fontWeight: 400, maxWidth: 620, mx: "auto", mb: 4 }}
            >
              Track your collection, forecast prices with machine learning, and trade in a
              live marketplace — all in one calm, data-dense terminal.
            </Typography>
          </Box>

          <Box
            component={motion.div}
            variants={itemV}
            sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}
          >
            <Button
              size="large"
              variant="contained"
              color="primary"
              endIcon={<ArrowForward />}
              onClick={() => router.push("/register")}
              sx={{ px: 4, py: 1.25 }}
            >
              Create your account
            </Button>
            <Button
              size="large"
              variant="outlined"
              color="inherit"
              onClick={() => router.push("/login")}
              sx={{ px: 4, py: 1.25, color: "text.primary" }}
            >
              I already have one
            </Button>
          </Box>
        </Box>

        {/* Feature grid */}
        <Box
          component={motion.div}
          initial={reduce ? false : "hidden"}
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={containerV}
          sx={{ pb: { xs: 8, md: 12 } }}
        >
          <Grid container spacing={3}>
            {FEATURES.map((f) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={f.title}>
                <Box component={motion.div} variants={itemV} sx={{ height: "100%" }}>
                  <Card sx={{ height: "100%" }}>
                    <CardContent sx={{ p: 3 }}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: 2,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "primary.main",
                          bgcolor: "action.selected",
                          mb: 2,
                        }}
                      >
                        {f.icon}
                      </Box>
                      <Typography variant="h6" sx={{ mb: 1 }}>
                        {f.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {f.desc}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Closing CTA */}
        <Box
          component={motion.div}
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          sx={{ pb: { xs: 8, md: 12 } }}
        >
          <Card
            sx={{
              textAlign: "center",
              p: { xs: 4, md: 6 },
              border: 1,
              borderColor: "divider",
              background: (t) => t.foil.gradientSoft,
            }}
          >
            <GradientHeading variant="h4" component="h2" sx={{ mb: 1.5 }}>
              Start tracking in minutes
            </GradientHeading>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 520, mx: "auto" }}>
              Import the collection you already have and see your portfolio come to life.
            </Typography>
            <Button
              size="large"
              variant="contained"
              color="primary"
              endIcon={<ArrowForward />}
              onClick={() => router.push("/register")}
              sx={{ px: 4, py: 1.25 }}
            >
              Get started free
            </Button>
          </Card>
        </Box>

        <Divider />
        <Box
          component="footer"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1,
            py: 3,
          }}
        >
          <Typography variant="body2" color="text.disabled">
            © 2026 Foil Alpha
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button size="small" color="inherit" onClick={() => router.push("/login")} sx={{ color: "text.secondary" }}>
              Log in
            </Button>
            <Button size="small" color="inherit" onClick={() => router.push("/register")} sx={{ color: "text.secondary" }}>
              Register
            </Button>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
