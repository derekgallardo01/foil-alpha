'use client';
import React, { useState, useEffect } from "react";
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
import Sidebar from "../components/Sidebar";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

const Dashboard = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch("/api/users");
        if (!response.ok) {
          throw new Error("Failed to fetch users");
        }
        const data: User[] = await response.json();
        setUsers(data);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  if (status === "loading" || loadingUsers) {
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
        <img src="https://i.ibb.co/ZBphxdZ/TCG-Market.png" alt="Logo" style={{ height: "60px" }} />
      </Box>

      <Watchlist />

      <Grid container spacing={2}>
        <Grid item xs={12}>
          {/*<TaskManagement /> */}
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;