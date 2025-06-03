import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

const initialTasks = [
  { id: uuidv4(), title: 'Complete project report', description: 'Finish the quarterly report for the project.', completed: false },
  { id: uuidv4(), title: 'Call client', description: 'Follow up with the client regarding the proposal.', completed: true },
  { id: uuidv4(), title: 'Review pull requests', description: 'Review the pull requests from the development team.', completed: false },
];

// Use a mutable reference to store tasks
let tasks = initialTasks;

export async function GET() {
  try {
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const newTask = await request.json();

    if (!newTask.title || !newTask.description) {
      return NextResponse.json({ error: 'Invalid task data' }, { status: 400 });
    }

    const taskWithId = { id: uuidv4(), ...newTask };
    tasks = [...tasks, taskWithId]; // Create new array instead of push
    return NextResponse.json({ message: 'Task added successfully', task: taskWithId });
  } catch (error) {
    console.error('Failed to add task:', error);
    return NextResponse.json({ error: 'Failed to add task' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const taskId = url.searchParams.get('id');

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const taskIndex = tasks.findIndex((task) => task.id === taskId);

    if (taskIndex === -1) {
      console.error('Task not found:', taskId);
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    tasks = tasks.filter((_, index) => index !== taskIndex); // Create new array instead of splice
    console.log(`Deleted task with ID: ${taskId}`);
    return NextResponse.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Failed to delete task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const url = new URL(request.url);
    const taskId = url.searchParams.get('id');

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const taskIndex = tasks.findIndex((task) => task.id === taskId);

    if (taskIndex === -1) {
      console.error('Task not found:', taskId);
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const updateData = await request.json();
    const updatedTask = {
      ...tasks[taskIndex],
      ...(updateData.title !== undefined && { title: updateData.title }),
      ...(updateData.description !== undefined && { description: updateData.description }),
      ...(updateData.completed !== undefined && { completed: updateData.completed }),
    };

    tasks = [
      ...tasks.slice(0, taskIndex),
      updatedTask,
      ...tasks.slice(taskIndex + 1),
    ]; // Create new array with updated task

    console.log(`Updated task with ID: ${taskId}`, updatedTask);
    return NextResponse.json({ message: 'Task updated successfully', task: updatedTask });
  } catch (error) {
    console.error('Failed to update task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}