import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import routes
import productRoutes from './routes/products.js';
import stageRoutes from './routes/stages.js';
import leadSourceRoutes from './routes/leadSources.js';
import userRoutes from './routes/users.js';
import leadRoutes from './routes/leads.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', productRoutes);
app.use('/api', stageRoutes);
app.use('/api', leadSourceRoutes);
app.use('/api', userRoutes);
app.use('/api', leadRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    message: 'Internal server error',
    error: err.message
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app; 