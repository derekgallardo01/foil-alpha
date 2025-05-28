import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Define a mock list of tasks
let tasks = [
  { id: uuidv4(), title: 'Complete project report', description: 'Finish the quarterly report for the project.', completed: false },
  { id: uuidv4(), title: 'Call client', description: 'Follow up with the client regarding the proposal.', completed: true },
  { id: uuidv4(), title: 'Review pull requests', description: 'Review the pull requests from the development team.', completed: false },
];

// Handler function to get the tasks
export async function GET() {
  try {
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// Handler function to create a new task
export async function POST(request: Request) {
  try {
    const newTask = await request.json();

    if (!newTask.title || !newTask.description) {
      return NextResponse.json({ error: 'Invalid task data' }, { status: 400 });
    }

    const taskWithId = { id: uuidv4(), ...newTask };  // Generate ID for new task
    tasks.push(taskWithId);  // Add the new task with a unique ID
    return NextResponse.json({ message: 'Task added successfully', task: taskWithId });
  } catch (error) {
    console.error('Failed to add task:', error);
    return NextResponse.json({ error: 'Failed to add task' }, { status: 500 });
  }
}

// Handler function to delete a task by its ID
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

    tasks.splice(taskIndex, 1); // Remove the task
    console.log(`Deleted task with ID: ${taskId}`);
    return NextResponse.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Failed to delete task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}

// Handler function to update a task's completion status
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

    const task = tasks[taskIndex];
    const updateData = await request.json();

    // Update task fields if provided in the request
    if (updateData.title !== undefined) {
      task.title = updateData.title;
    }

    if (updateData.description !== undefined) {
      task.description = updateData.description;
    }

    if (updateData.completed !== undefined) {
      task.completed = updateData.completed;
    }

    console.log(`Updated task with ID: ${taskId}`, task);
    return NextResponse.json({ message: 'Task updated successfully', task });
  } catch (error) {
    console.error('Failed to update task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

