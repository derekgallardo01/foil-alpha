'use client';
import React, { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation"; // Correct import

import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  TextField,
  Button,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Checkbox,
  IconButton,
  Paper,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

const Dashboard = () => {
  const { data: session, status } = useSession(); // Use the useSession hook to manage the session
  const router = useRouter(); // Using useRouter in client-side component
  const [users, setUsers] = useState<User[]>([]); // State to store the list of users
  const [loadingUsers, setLoadingUsers] = useState(true); // State to manage loading for users
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({ title: "", description: "" });
  const [editingTask, setEditingTask] = useState(null); // Track the task currently being edited
  const [editedTask, setEditedTask] = useState({ title: "", description: "" });
  const [isModalOpen, setModalOpen] = useState(false);

  interface User {
    id: number;
    name: string;
    email: string;
    role: string;
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin"); // Redirect to sign-in if the user is not authenticated
    }
  }, [status, router]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch("/api/users"); // Correct endpoint for fetching users
        if (!response.ok) {
          throw new Error("Failed to fetch users");
        }
        const data: User[] = await response.json();
        setUsers(data); // Set the users in the state
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoadingUsers(false); // Set loading to false after fetching
      }
    };

    fetchUsers();
  }, []); // Fetch users only once when the component mounts

  useEffect(() => {
    const fetchTasks = async () => {
      const response = await fetch("/api/tasks");
      const data = await response.json();
      setTasks(data);
    };
    fetchTasks();
  }, []); // Empty dependency array means this runs only once on mount

  if (status === "loading" || loadingUsers) {
    return <Typography>Loading...</Typography>; // Display a loading state while session and users are being fetched
  }

  if (!session) {
    return null; // If there's no session, don't render the page (redirects will handle this)
  }

  const isAdmin = session.user.role === "admin";
  const isUser = session.user.role === "user";

  // Function to capitalize the first letter of the name
  const capitalizeName = (name: string) => {
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };

  const handleAddTask = async (title, description) => {
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const result = await response.json();
      if (result.task) {
        // Update the state with the new task
        setTasks((prevTasks) => [...prevTasks, result.task]);  // Add new task to the list
        setNewTask({ title: "", description: "" });  // Reset form fields
      } else {
        console.error("Failed to add task:", result.error);
      }
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };
  const handleEditTask = (task) => {
    setEditingTask(task); // Set task to be edited
    setEditedTask({ title: task.title, description: task.description }); // Pre-fill form
  };

  const handleSaveEdit = async () => {
    if (!editingTask) return;

    const updatedTaskData = { ...editingTask, title: editedTask.title, description: editedTask.description };

    try {
      const response = await fetch(`/api/tasks?id=${editingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedTaskData),
      });

      if (!response.ok) throw new Error("Failed to update task");

      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === editingTask.id ? { ...task, title: editedTask.title, description: editedTask.description } : task
        )
      );

      setEditingTask(null); // Reset editing state
      setEditedTask({ title: "", description: "" }); // Reset form fields
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditingTask(null);
    setEditedTask({ title: "", description: "" });
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const response = await fetch(`/api/tasks?id=${taskId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete task");

      setTasks(tasks.filter((task) => task.id !== taskId)); // Remove task from state
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const handleTaskCompletionToggle = async (taskId, currentStatus) => {
    try {
      const response = await fetch(`/api/tasks?id=${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !currentStatus }),
      });

      if (!response.ok) throw new Error("Failed to update task status");

      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === taskId ? { ...task, completed: !currentStatus } : task
        )
      );
    } catch (error) {
      console.error("Error toggling task completion:", error);
    }
  };

  return (
    <Container>
      {/* App Logo */}
      <Box sx={{ display: "flex", justifyContent: "center", my: 3 }}>
        <img src="https://i.ibb.co/ZBphxdZ/TCG-Market.png" alt="App Logo" style={{ height: "60px" }} />
      </Box>

      <Grid container spacing={2}>
        {/* Tasks Card */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom>Tasks</Typography>
              <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
                <TextField
                  label="Task Title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  fullWidth
                />
                <TextField
                  label="Task Description"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  fullWidth
                />
                <Button variant="contained" color="primary" onClick={() => handleAddTask(newTask.title, newTask.description)}>
                  Add Task
                </Button>
              </Box>

              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Title</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Completed</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tasks.map((task, index) => (
                      <TableRow key={task.id || index}>
                        <TableCell>
                          {editingTask && editingTask.id === task.id ? (
                            <TextField
                              value={editedTask.title}
                              onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                              fullWidth
                            />
                          ) : (
                            task.title
                          )}
                        </TableCell>
                        <TableCell>
                          {editingTask && editingTask.id === task.id ? (
                            <TextField
                              value={editedTask.description}
                              onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                              fullWidth
                            />
                          ) : (
                            task.description
                          )}
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={task.completed}
                            onChange={() => handleTaskCompletionToggle(task.id, task.completed)}
                          />
                        </TableCell>
                        <TableCell>
                          {editingTask && editingTask.id === task.id ? (
                            <div>
                              <Button onClick={handleSaveEdit} variant="contained" color="primary">
                                Save
                              </Button>
                              <Button onClick={handleCancelEdit} variant="outlined" color="secondary">
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div>
                              <IconButton color="primary" onClick={() => handleEditTask(task)}>
                                <EditIcon />
                              </IconButton>
                              <IconButton color="error" onClick={() => handleDeleteTask(task.id)}>
                                <DeleteIcon />
                              </IconButton>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Account Settings Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom>Account Settings</Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {/* Add relevant content for Account Settings */}
                <TextField label="Username" variant="outlined" fullWidth />
                <TextField label="Email" variant="outlined" fullWidth />
                <Button variant="contained" color="primary">
                  Save Settings
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Notifications Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom>Notifications</Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {/* Add relevant content for Notifications */}
                <TextField label="Email" variant="outlined" fullWidth />
                <Button variant="contained" color="primary">
                  Update Email
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;
