# Full Stack Collaborative To-Do Board

A real-time collaborative task management application built with modern web technologies. This project features a Kanban-style board with drag-and-drop functionality, real-time synchronization, smart task assignment, and conflict resolution.

## 🚀 Live Demo

- **Live Application**: [https://your-app-name.vercel.app](https://todo-board-1.vercel.ap/)
- **Demo Video**: [https://youtu.be/your-demo-video](https://drive.google.com/file/d/1QsHhBoFH7c7Rn5LaH8s5vzgEQslV5hY6)
- **GitHub Repository**: [https://github.com/yourusername/collaborative-todo-board](https://github.com/kalyan021004/TodoBoard)

## 📋 Project Overview

This collaborative to-do board allows multiple users to work together on tasks in real-time. Users can create, update, delete, and assign tasks across three columns (Todo, In Progress, Done) with seamless synchronization across all connected clients.

### Key Features

- **Real-time Collaboration**: Multiple users can work simultaneously with instant updates
- **Drag & Drop Interface**: Intuitive Kanban-style board with smooth animations
- **Smart Task Assignment**: Automatically assigns tasks to users with the least workload
- **Conflict Resolution**: Handles concurrent edits gracefully with version control
- **Activity Logging**: Tracks all user actions with timestamps
- **User Authentication**: Secure login/registration system
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Custom Styling**: Built with vanilla CSS for optimal performance

## 🛠️ Tech Stack

### Frontend
- **React 18** (with Vite for faster development)
- **React Router DOM** - Client-side routing
- **Socket.IO Client** - Real-time communication
- **Axios** - HTTP client for API requests
- **Custom CSS** - Responsive styling without frameworks

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB ODM
- **Socket.IO** - Real-time bidirectional communication
- **JWT** - JSON Web Token authentication
- **bcrypt** - Password hashing

### Additional Tools
- **MongoDB Atlas** - Cloud database
- **Vercel** - Frontend deployment
- **Render/Railway** - Backend deployment
- **Postman** - API testing

## 🏗️ Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local installation or Atlas account)
- Git

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/kalyan021004/TodoBoard.git
   cd todoboard
   
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Create environment variables**
   ```bash
   # Create .env file in backend directory
   touch .env
   ```

4. **Configure environment variables**
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/todo-board
   # OR for MongoDB Atlas:
   # MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/todo-board
   
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRES_IN=7d
   NODE_ENV=development
   ```

5. **Start the backend server**
   ```bash
   npm run dev
   # OR for production
   npm start
   ```

The backend server will run on `http://localhost:5000`

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd ../frontend
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Create environment variables**
   ```bash
   # Create .env file in frontend directory
   touch .env
   ```

4. **Configure environment variables**
   ```env
   VITE_API_URL=http://localhost:5000
   VITE_SOCKET_URL=http://localhost:5000
   ```

5. **Start the frontend development server**
   ```bash
   npm run dev
   ```

The frontend will run on `http://localhost:3000`

### Database Setup

#### Option 1: Local MongoDB
1. Install MongoDB locally
2. Start MongoDB service
3. Use connection string: `mongodb://localhost:27017/todo-board`

#### Option 2: MongoDB Atlas (Recommended)
1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create new cluster
3. Get connection string
4. Replace `MONGODB_URI` in `.env` file

## 📱 Usage Guide

### Getting Started
1. **Registration**: Create a new account with username, email, and password
2. **Login**: Sign in with your credentials
3. **Dashboard**: Access the main Kanban board interface

### Task Management
- **Create Task**: Click "Add Task" button and fill in details
- **Edit Task**: Click on any task card to edit title, description, or assignment
- **Delete Task**: Use the delete button on task cards
- **Move Tasks**: Drag and drop tasks between columns (Todo → In Progress → Done)

### Collaboration Features
- **Real-time Updates**: See changes from other users instantly
- **Smart Assign**: Use "Smart Assign" button to automatically assign tasks to users with fewer active tasks
- **Activity Log**: View recent actions by all users in the activity panel
- **User Presence**: See who's currently online

### Conflict Resolution
When multiple users edit the same task simultaneously:
1. System detects the conflict
2. Conflict resolution modal appears
3. Choose to merge changes or overwrite
4. All users are notified of the resolution

## 🧠 Smart Assign Logic

The Smart Assign feature automatically distributes tasks to balance workload:

### Algorithm
1. **Count Active Tasks**: Calculate tasks assigned to each user in "Todo" and "In Progress" columns
2. **Find Minimum**: Identify user(s) with the fewest active tasks
3. **Random Selection**: If multiple users have the same minimum count, randomly select one
4. **Assignment**: Assign the task and notify all users

### Implementation Details
```javascript
// Pseudo-code for Smart Assign
function smartAssign(taskId) {
  const users = getAllActiveUsers();
  const taskCounts = users.map(user => ({
    user,
    activeTaskCount: getActiveTaskCount(user.id)
  }));
  
  const minCount = Math.min(...taskCounts.map(u => u.activeTaskCount));
  const candidateUsers = taskCounts.filter(u => u.activeTaskCount === minCount);
  
  const selectedUser = candidateUsers[Math.floor(Math.random() * candidateUsers.length)];
  
  return assignTask(taskId, selectedUser.user.id);
}
```

## ⚡ Conflict Handling

### Optimistic Concurrency Control
- Each task has a version number that increments with every update
- When updating a task, the client sends the current version number
- Server checks if the version matches the database version
- If versions don't match, a conflict is detected

### Conflict Resolution Process
1. **Detection**: Server identifies version mismatch
2. **Preservation**: Both versions (client and server) are temporarily stored
3. **Notification**: All users are notified of the conflict
4. **Resolution Interface**: Modal displays both versions side-by-side
5. **User Choice**: User can choose to merge or overwrite
6. **Synchronization**: Resolution is broadcast to all connected clients

### Technical Implementation
```javascript
// Conflict detection middleware
async function checkConflict(req, res, next) {
  const { id, version } = req.body;
  const currentTask = await Task.findById(id);
  
  if (currentTask.version !== version) {
    return res.status(409).json({
      conflict: true,
      clientVersion: req.body,
      serverVersion: currentTask
    });
  }
  
  next();
}
```

## 🏃‍♂️ Available Scripts

### Backend
```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm test           # Run tests
```

### Frontend
```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

## 🚀 Deployment

### Backend Deployment (Render/Railway)
1. Create account on Render or Railway
2. Connect GitHub repository
3. Configure environment variables
4. Deploy from main branch

### Frontend Deployment (Vercel/Netlify)
1. Create account on Vercel or Netlify
2. Connect GitHub repository
3. Configure build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Set environment variables
5. Deploy

### Environment Variables for Production
```env
# Backend
MONGODB_URI=your-atlas-connection-string
JWT_SECRET=your-production-jwt-secret
NODE_ENV=production

# Frontend
VITE_API_URL=[https://your-backend-url.com](https://todoboard-1-nvnk.onrender.com)
VITE_SOCKET_URL=[https://your-backend-url.com](https://todoboard-1-nvnk.onrender.com)
```

## 📁 Project Structure  
collaborative-todo-board/
├── backend/
│   ├── models/
│   │   ├── user.models.js
│   │   ├── task.models.js
│   │   └── activity.models.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── tasks.routes.js
│   │   └── user.routes.js
│   ├── middleware/
│   │   ├── activityLog.js
│   │   ├── auth.js
│   │   ├── conflictDetection.js
│   │   └── taskValidation.js
│   ├── sockets/
│   │   └── socket.js
│   ├── utils/
│   │   ├── jwt.js
│   │   └── smartAssign.js
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ActivityLogPanel.jsx
│   │   │   ├── ConflictModal.jsx
│   │   │   ├── FilterBar.jsx
│   │   │   ├── KanbanBoard.jsx
│   │   │   ├── KanbanColumn.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── NotificationContainer.jsx
│   │   │   ├── OnlineUsers.jsx
│   │   │   ├── PrivateRoute.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── TaskCard.jsx
│   │   │   └── TaskModal.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.js
│   │   │   ├── SocketContext.js
│   │   │   └── ToastContext.js
│   │   ├── hooks/
│   │   │   ├── useSmartAssign.js
│   │   │   ├── useSocketTasks.js
│   │   │   ├── useSocketUsers.js
│   │   │   └── useTasks.js
│   │   ├── pages/
│   │   │   └── Dashboard.jsx
│   │   ├── styles/
│   │   │   ├── ActivityLog.css
│   │   │   ├── Auth.css
│   │   │   ├── ConflictModal.css
│   │   │   ├── Dashboard.css
│   │   │   ├── FilterBar.css
│   │   │   ├── KanbanBoard.css
│   │   │   ├── KanbanColumn.css
│   │   │   ├── Modal.css
│   │   │   ├── NotificationContainer.css
│   │   │   ├── OnlineUsers.css
│   │   │   ├── TaskCard.css
│   │   │   └── TaskModal.css
│   │   ├── utils/
│   │   │   └── your-utility-files-here.js
│   │   ├── App.css
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   └── public/
└── README.md


## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


## 🙏 Acknowledgments

- Socket.IO for real-time communication
- MongoDB for flexible data storage
- React community for excellent documentation
- Vite for blazing-fast development experience




**Built with ❤️ by [Venkata Kalyan Chittiboina]**
