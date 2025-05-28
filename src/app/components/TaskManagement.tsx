'use client';
import React, { useState, useEffect } from "react";
import {
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

interface Task {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

interface TaskManagementProps {
  initialTasks?: Task[]; // Optional prop for initial tasks if needed
}

const TaskManagement: React.FC<TaskManagementProps> = ({ initialTasks = [] }) => {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [newTask, setNewTask] = useState({ title: "", description: "" });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editedTask, setEditedTask] = useState({ title: "", description: "" });

  useEffect(() => {
    const fetchTasks = async () => {
      const response = await fetch("/api/tasks");
      const data = await response.json();
      setTasks(data);
    };
    fetchTasks();
  }, []);

  const handleAddTask = async (title: string, description: string) => {
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const result = await response.json();
      if (result.task) {
        setTasks((prevTasks) => [...prevTasks, result.task]);
        setNewTask({ title: "", description: "" });
      } else {
        console.error("Failed to add task:", result.error);
      }
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setEditedTask({ title: task.title, description: task.description });
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

      setEditingTask(null);
      setEditedTask({ title: "", description: "" });
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditingTask(null);
    setEditedTask({ title: "", description: "" });
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      const response = await fetch(`/api/tasks?id=${taskId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete task");

      setTasks(tasks.filter((task) => task.id !== taskId));
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const handleTaskCompletionToggle = async (taskId: number, currentStatus: boolean) => {
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
  );
};

export default TaskManagement;