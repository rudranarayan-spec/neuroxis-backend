import { expressConnectMiddleware } from '@connectrpc/connect-express';

// Import Services
import { AuthService } from '../gen/auth_connect.js';
import { MatchService } from '../gen/match_connect.js';
import { LeaderboardService } from '../gen/leaderboard_connect.js';

// Import Controllers
import { grpcAuthController } from '../controllers/grpc/grpcAuthController.js';
import { grpcMatchController } from '../controllers/grpc/grpcMatchController.js';
import { grpcLeaderboardController } from '../controllers/grpc/grpcLeaderboardController.js';

export const grpcRouter = expressConnectMiddleware({
  routes(router) {
    router.service(AuthService, grpcAuthController);
    router.service(MatchService, grpcMatchController);
    router.service(LeaderboardService, grpcLeaderboardController);
  },
  // Allow JSON parsing over HTTP 1.1/2
  acceptCompression: [],
});