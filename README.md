# Full Stack Collaborative To-Do Board

A real-time collaborative task management application built with modern web technologies. This project features a Kanban-style board with drag-and-drop functionality, real-time synchronization, smart task assignment, and conflict resolution.

## 🚀 Live Demo

* **Live Application**: [https://todo-board-1.vercel.app](https://todo-board-1.vercel.app)
* **Demo Video**: [Watch on Google Drive](https://drive.google.com/file/d/1QsHhBoFH7c7Rn5LaH8s5vzgEQslV5hY6)
* **GitHub Repository**: [https://github.com/kalyan021004/TodoBoard](https://github.com/kalyan021004/TodoBoard)

## 📋 Project Overview

This collaborative to-do board allows multiple users to work together on tasks in real-time. Users can create, update, delete, and assign tasks across three columns (Todo, In Progress, Done) with seamless synchronization across all connected clients.

### Key Features

* **Real-time Collaboration**: Multiple users can work simultaneously with instant updates
* **Drag & Drop Interface**: Intuitive Kanban-style board with smooth animations
* **Smart Task Assignment**: Automatically assigns tasks to users with the least workload
* **Conflict Resolution**: Handles concurrent edits gracefully with version control
* **Activity Logging**: Tracks all user actions with timestamps
* **User Authentication**: Secure login/registration system
* **Responsive Design**: Works seamlessly on desktop and mobile devices
* **Custom Styling**: Built with vanilla CSS for optimal performance

## 🛠️ Tech Stack

### Frontend

* **React 18** (with Vite for faster development)
* **React Router DOM**
* **Socket.IO Client**
* **Axios**
* **Custom CSS**

### Backend

* **Node.js**
* **Express.js**
* **MongoDB**
* **Mongoose**
* **Socket.IO**
* **JWT**
* **bcrypt**

### Additional Tools

* **MongoDB Atlas**
* **Vercel**
* **Render/Railway**
* **Postman**

## 🏗️ Installation & Setup

### Prerequisites

* Node.js (v16+)
* MongoDB (local or Atlas)
* Git

### Backend Setup

```bash
git clone https://github.com/kalyan021004/TodoBoard.git
cd TodoBoard
cd backend
npm install
```

Create `.env` file in `/backend` with:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/todo-board
# or Atlas
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/todo-board
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

Start backend:

```bash
npm run dev
```

### Frontend Setup

```bash
cd ../frontend
npm install
```

Create `.env` in `/frontend`:

```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

Start frontend:

```bash
npm run dev
```

## 📱 Usage Guide

* Register and Login
* Create, edit, delete tasks
* Drag-and-drop across columns
* Smart Assign distributes tasks
* See real-time activity
* Conflict resolution for simultaneous edits

## 🧐 Smart Assign Logic

```js
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

* Tasks have version numbers
* When versions mismatch → server detects conflict
* Server sends both versions back
* Modal shown to user to resolve manually
* All connected users updated after resolution

## 🏃‍♂️ Available Scripts

### Backend

```bash
npm run dev        # Dev server
npm start          # Prod server
npm test           # Run tests
```

### Frontend

```bash
npm run dev        # Dev server
npm run build      # Build for production
npm run preview    # Preview
npm run lint       # ESLint
```

## 🚀 Deployment

### Backend (Render or Railway)

* Connect GitHub repo
* Set environment variables

### Frontend (Vercel)

* Build command: `npm run build`
* Output directory: `dist`
* Set environment variables

```env
VITE_API_URL=https://todoboard-1-nvnk.onrender.com
VITE_SOCKET_URL=https://todoboard-1-nvnk.onrender.com
```

## 📁 Project Structure

```
collaborative-todo-board/
├── backend/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── sockets/
│   ├── utils/
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── styles/
│   │   ├── utils/
│   │   └── main.jsx
│   └── public/
└── README.md
```

## 🤝 Contributing

```bash
# Fork + Clone
git checkout -b feature/your-feature
# Make changes
git commit -m "Added your feature"
git push origin feature/your-feature
# Open Pull Request
```

## 🙏 Acknowledgments

* React, Vite, Socket.IO
* MongoDB & Mongoose
* Vercel, Render
* Built with ❤️ by [Venkata Kalyan Chittiboina](https://github.com/kalyan021004)
