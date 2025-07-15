import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext'; // Add this import
import PrivateRoute from './components/PrivateRoute';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './pages/Dashboard';
import { ToastProvider } from './context/ToastContext';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
            <ToastProvider>
 {/* Add SocketProvider here */}
        <Router>
          <div className="App">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              } />
              <Route path="/" element={<Navigate to="/dashboard" />} />
            </Routes>
          </div>
        </Router>
            </ToastProvider>

      </SocketProvider> {/* Close SocketProvider here */}
    </AuthProvider>
  );
}

export default App;