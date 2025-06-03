'use client';
import React, { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Watchlist from "../components/Watchlist";
import TaskManagement from "../components/TaskManagement";
import MenuIcon from "@mui/icons-material/Menu";
import {
  Container,
  Grid,
  Typography,
  Box,
  IconButton,
} from "@mui/material";
import Image from "next/image";
import Sidebar from "../components/Sidebar";

const Dashboard = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  if (status === "loading") {
    return <Typography>Loading...</Typography>;
  }

  if (!session) {
    return null;
  }

  return (
    <Container>
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", my: 3 }}>
        <IconButton onClick={toggleSidebar}>
          <MenuIcon />
        </IconButton>
        <Image
          src="https://i.ibb.co/ZBphxdZ/TCG-Market.png"
          alt="Logo"
          height={60}
          width={150} // Adjust based on logo's aspect ratio
        />
      </Box>

      <Watchlist />

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TaskManagement />
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;