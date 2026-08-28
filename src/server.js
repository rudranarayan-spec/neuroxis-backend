import 'dotenv/config';
import dns from 'node:dns';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupMatchmaking } from './sockets/matchmaking.js';

dns.setServers(['1.1.1.1', '8.8.8.8']);

import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import restRoutes from './routes/index.js';
import { grpcRouter } from './routes/grpcRoutes.js';

const app = express();
const httpServer = createServer(app);

// 1. Initialize Socket.io on httpServer
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// 2. Setup Matchmaking Socket Handlers
setupMatchmaking(io);

// 3. Configure CORS to accept ConnectRPC headers
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

// 4. Mount gRPC ConnectRPC Router
app.use(grpcRouter);

// 5. Express Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

await connectDB();

app.use('/api/v1', restRoutes);

const PORT = process.env.PORT || 5001;
const HOST = '0.0.0.0';

// 6. Use httpServer.listen instead of app.listen
httpServer.listen(PORT, HOST, () => {
  console.log(`\n=================================`);
  console.log(`   NEUROXIS REST + gRPC + SOCKET ENGINE     `);
  console.log(`   Host: http://${HOST}:${PORT}   `);
  console.log(`=================================\n`);
});