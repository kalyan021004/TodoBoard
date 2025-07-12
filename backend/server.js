// server.js or app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { initializeSocket } from './sockets/socket.js';
import connectDB from './config/db.js';
import taskRoutes from './routes/task.routes.js';
import userRoutes from './routes/user.routes.js';
import authRoutes from './routes/auth.routes.js';

dotenv.config();

const app = express();
const server = createServer(app);

// Initialize Socket.io
const io = initializeSocket(server);

// ✅ Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin:"https://todo-board-1.vercel.app" || "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    socketConnections: io.engine.clientsCount
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 Socket.io server initialized`);
});

export default app;
