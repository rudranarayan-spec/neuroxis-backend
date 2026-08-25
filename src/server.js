import 'dotenv/config';
import dns from 'node:dns';

dns.setServers(['1.1.1.1', '8.8.8.8']);

import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import restRoutes from './routes/index.js';
import { grpcRouter } from './routes/grpcRoutes.js';

const app = express();

// 1. Configure CORS to accept ConnectRPC headers
app.use(
  cors({
    origin: '*',
    allowedHeaders: [
      'Content-Type',
      'Connect-Protocol-Version',
      'Connect-Timeout-Ms',
      'Authorization',
      'X-User-Agent',
      'X-Grpc-Web',
    ],
    exposedHeaders: [
      'Grpc-Status',
      'Grpc-Message',
      'Grpc-Accept-Encoding',
      'Connect-Content-Encoding',
    ],
  })
);

// 2. Mount gRPC ConnectRPC Router FIRST (before express.json)
app.use(grpcRouter);

// 3. Express Body Parsers (For standard REST routes only)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

await connectDB();

app.use('/api/v1', restRoutes);

const PORT = process.env.PORT || 5001;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`\n=================================`);
  console.log(`   NEUROXIS REST + gRPC ENGINE     `);
  console.log(`   Host: http://${HOST}:${PORT}   `);
  console.log(`=================================\n`);
});