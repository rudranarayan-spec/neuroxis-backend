import 'dotenv/config'; 
import dns from 'node:dns';

dns.setServers(['1.1.1.1', '8.8.8.8']);

import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { redis } from './config/redis.js';
import routes from './routes/index.js';

const app = express();

// Global Middlewares
app.use(cors({ origin: '*' }));
app.use(express.json());

// Database Connections
await connectDB();

// Mount All API Routes under /api/v1
app.use('/api/v1', routes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`\n=================================`);
  console.log(`  NEUROXIS GAME ENGINE ACTIVE     `);
  console.log(`  Port: ${PORT}                  `);
  console.log(`  Environment: ${process.env.NODE_ENV} `);
  console.log(`=================================`);
});