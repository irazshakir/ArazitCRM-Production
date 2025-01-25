import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { createServer } from 'http';
import fileUpload from 'express-fileupload';
import path from 'path';
import fs from 'fs';


// Import routes
import productRoutes from './routes/products.js';
import stageRoutes from './routes/stages.js';
import leadSourceRoutes from './routes/leadSources.js';
import userRoutes from './routes/users.js';
import leadRoutes from './routes/leads.js';
import authRoutes from './src/routes/auth.routes.js';
import customUmrahRoutes from './routes/customUmrah.js';
import invoiceRoutes from './routes/invoices.js';
import branchRoutes from './routes/branches.js';
import webhookRoutes from './routes/webhookRoutes.js';
import dashboardRoutes from './routes/dashboard.js';
import reportsRoutes from './routes/reports.js';
import userDashboardRoutes from './routes/userDashboard.js';
import userLeadsRouter from './routes/userLeads.js';
import templateMessageRoutes from './routes/templateMessages.js';
import cannedMessagesRoutes from './routes/cannedMessages.js';
import accountRoutes from './routes/accounts.js';

// Initialize dotenv
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const app = express();

// Middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : [
      "http://localhost:3000", 
      "http://localhost:5173", 
      "https://app.indegotourism.com",
      "http://app.indegotourism.com"  // Add both http and https versions
    ];




app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if(!origin) return callback(null, true);
    if(allowedOrigins.indexOf(origin) === -1){
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json());
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: tempDir
}));



// Routes
app.use('/api', authRoutes);
app.use('/api', leadRoutes);
app.use('/api', productRoutes);
app.use('/api', stageRoutes);
app.use('/api', leadSourceRoutes);
app.use('/api', userRoutes);
app.use('/api', customUmrahRoutes);
app.use('/api', invoiceRoutes);
app.use('/api', branchRoutes);
app.use('/api', webhookRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api', userDashboardRoutes);
app.use('/api', userLeadsRouter);
app.use('/api', templateMessageRoutes);
app.use('/api', cannedMessagesRoutes);
app.use('/api', accountRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  res.status(500).json({
    message: 'Internal server error',
    error: err.message
  });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Store io instance on app
app.io = io;

// Make PORT configuration more explicit
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});

export { app, httpServer, io }; 