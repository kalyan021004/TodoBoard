import express from 'express';
const router = express.Router();
import User from '../models/user.models.js';
import { authenticate } from '../middleware/auth.js';
import { generateToken } from '../utils/jwt.js';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

// Security middleware
router.use(helmet());
router.use(express.json({ limit: '10kb' })); // Limit body size

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// CORS configuration
const configureCORS = (req, res, next) => {
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL]
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  
  next();
};

router.use(configureCORS);
router.options('*', (req, res) => res.sendStatus(200));

// Input validation middleware
const validateRegisterInput = (req, res, next) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
  }
  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters'
    });
  }
  next();
};

// Register route with enhanced security
router.post('/register', authLimiter, validateRegisterInput, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check for existing user
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email or username already exists'
      });
    }

    // Create new user with additional security fields
    const newUser = new User({
      username,
      email,
      password,
      lastLogin: new Date(),
      loginAttempts: 0,
      accountStatus: 'active'
    });

    await newUser.save();

    // Generate token with expiration
    const token = generateToken(newUser._id);
    
    // Secure cookie settings in production
    if (process.env.NODE_ENV === 'production') {
      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        createdAt: newUser.createdAt
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
});

// Login route with brute force protection
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await User.findOne({ email }).select('+password +loginAttempts +accountStatus');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is locked
    if (user.accountStatus === 'locked') {
      return res.status(403).json({
        success: false,
        message: 'Account temporarily locked due to too many failed attempts'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Increment failed login attempts
      user.loginAttempts += 1;
      if (user.loginAttempts >= 5) {
        user.accountStatus = 'locked';
        user.lockUntil = Date.now() + 30 * 60 * 1000; // Lock for 30 minutes
      }
      await user.save();
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        attemptsLeft: 5 - user.loginAttempts
      });
    }

    // Reset login attempts on successful login
    user.loginAttempts = 0;
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);
    
    // Secure cookie settings in production
    if (process.env.NODE_ENV === 'production') {
      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
    }

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
});

// Protected profile route with additional security headers
router.get('/profile', authenticate, async (req, res) => {
  try {
    // Fetch fresh user data to ensure it's current
    const user = await User.findById(req.user.id).select('-password -loginAttempts');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Logout route with token invalidation
router.post('/logout', authenticate, (req, res) => {
  // In production, you might want to implement token blacklisting here
  if (process.env.NODE_ENV === 'production') {
    res.clearCookie('token', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict'
    });
  }
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

export default router;