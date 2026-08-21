import 'dotenv/config'; 
import dns from 'node:dns';

dns.setServers(['1.1.1.1', '8.8.8.8']);

import express from 'express';
import cors from 'cors';
import { expressConnectMiddleware } from '@connectrpc/connect-express';
import { connectDB } from './config/db.js';
import restRoutes from './routes/index.js';

// Import generated gRPC Service definition & Controller
import { AuthService } from './gen/auth_connect.js';
import { grpcAuthController } from './controllers/grpcAuthController.js';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

await connectDB();

// 1. Mount standard REST API routes
app.use('/api/v1', restRoutes);

// 2. Mount gRPC Service handler
app.use(
  expressConnectMiddleware({
    routes(router) {
      router.service(AuthService, grpcAuthController);
    },
  })
);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`\n=================================`);
  console.log(`  NEUROXIS REST + gRPC ENGINE     `);
  console.log(`  Port: ${PORT}                  `);
  console.log(`=================================\n`);
});