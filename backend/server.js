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

// ✅ Proper CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://todo-board-1.vercel.app',  // Production frontend
      'http://localhost:3000',            // React dev server
      'http://localhost:5173',            // Vite dev server
      'http://localhost:5174',            // Vite dev server (alternative port)
      'http://localhost:5000',           // Your local backend port
      'http://127.0.0.1:5173',           // Alternative localhost format
      'http://127.0.0.1:3000',           // Alternative localhost format
    ];

    // Allow all localhost/127.0.0.1 origins for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      console.log(`✅ CORS allowed localhost origin: ${origin}`);
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      console.log(`✅ CORS allowed origin: ${origin}`);
      callback(null, true);
    } else {
      console.log(`❌ CORS blocked origin: ${origin}`);
      console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

// ✅ Connect to MongoDB
await connectDB(); // make this top-level await or wrap in async IIFE if not using "type": "module"

// ✅ JSON body parsing
app.use(express.json());

// ✅ API Routes
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);

// ✅ Health Check Endpoint
let io;
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    socketConnections: io?.engine?.clientsCount || 0
  });
});
// In server.js
app.get('/api/socket-debug', (req, res) => {
  const users = getOnlineUsers();
  res.json({
    onlineCount: users.length,
    users,
    socketConnected: !!io,
    timestamp: new Date().toISOString()
  });
});


// ✅ Initialize Socket.IO
io = initializeSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 Socket.IO initialized`);
});