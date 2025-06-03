'use client';
import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import TaskManagement from "../components/TaskManagement";
import { Container, Typography, Box, IconButton } from "@mui/material";
import Sidebar from "../components/Sidebar";
import MenuIcon from "@mui/icons-material/Menu";
import Image from "next/image";

const TasksPage = () => {
  const { status } = useSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

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
        <Image
          src="https://i.ibb.co/ZBphxdZ/TCG-Market.png"
          alt="Logo"
          width={120} // Adjust based on your needs
          height={60} // Matches the original height
          style={{ height: "60px", width: "auto" }}
        />
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