'use client';
import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import TaskManagement from "../components/TaskManagement";
import { Container, Typography, Box } from "@mui/material";
import Sidebar from "../components/Sidebar";
import {
    Grid,
    Card,
    CardContent,
    TextField,
    Button,
    IconButton,
  } from "@mui/material";
  import MenuIcon from "@mui/icons-material/Menu";

const TasksPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false); // Move useState inside the component

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen); // Move toggleSidebar inside the component

  if (status === "loading") {
    return <Typography>Loading...</Typography>;
  }

  if (status === "unauthenticated") {
    router.push("/auth/signin");
    return null;
  }

  return (
    <Container sx={{ marginTop: 4, marginBottom: 4 }}>
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
            {/* Top Bar with Menu Button */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", my: 3 }}>
        <IconButton onClick={toggleSidebar}>
          <MenuIcon />
        </IconButton>
        <img src="https://i.ibb.co/ZBphxdZ/TCG-Market.png" alt="Logo" style={{ height: "60px" }} />
      </Box>
      <Box sx={{ my: 3 }}>
        <Typography variant="h4" gutterBottom>
          Task Management
        </Typography>
      </Box>
      <TaskManagement />
    </Container>
  );
};

export default TasksPage;