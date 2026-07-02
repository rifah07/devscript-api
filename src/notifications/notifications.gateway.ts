import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';

// ─── DEPLOYMENT STEPS (AWS / VPS) ────────────────────────────────────────────
//
// STEP 1 — Enable this gateway in notifications.module.ts
//   Add NotificationsGateway to the providers array.
//   It is commented out by default because Vercel doesn't support WebSockets.
//
// STEP 2 — Configure CORS in @WebSocketGateway decorator below
//   Replace 'http://localhost:3000' with your actual frontend domain.
//   e.g. 'https://devscript.com'
//
// STEP 3 — If using multiple server instances (horizontal scaling on AWS):
//   Install Redis adapter: npm install @socket.io/redis-adapter ioredis
//   Then in notifications.module.ts, configure the Redis adapter so all
//   instances share the same Socket.IO state:
//
//   import { createAdapter } from '@socket.io/redis-adapter';
//   import { createClient } from 'redis';
//
//   const pubClient = createClient({ url: process.env.REDIS_URL });
//   const subClient = pubClient.duplicate();
//   await Promise.all([pubClient.connect(), subClient.connect()]);
//   io.adapter(createAdapter(pubClient, subClient));
//
// STEP 4 — Configure your load balancer for sticky sessions (if using ELB):
//   WebSockets require the same client to hit the same server instance.
//   Enable sticky sessions in AWS ELB target group settings.
//   OR use the Redis adapter (Step 3) which removes this requirement.
//
// STEP 5 — Open port 3000 (or your app port) in AWS Security Group
//   Inbound rule: Custom TCP, Port 3000, Source: 0.0.0.0/0
//   WebSockets use the same port as your HTTP server — no extra port needed.
//
// STEP 6 — Update your Nginx config (if using Nginx as reverse proxy):
//   location /socket.io/ {
//     proxy_pass http://localhost:3000;
//     proxy_http_version 1.1;
//     proxy_set_header Upgrade $http_upgrade;
//     proxy_set_header Connection "upgrade";
//     proxy_set_header Host $host;
//     proxy_cache_bypass $http_upgrade;
//   }
//
// STEP 7 — On the frontend, connect to the WebSocket:
//   import { io } from 'socket.io-client';
//   const socket = io('https://your-api.com', {
//     auth: { token: 'YOUR_JWT_ACCESS_TOKEN' }
//   });
//   socket.on('notification', (data) => console.log(data));
//   socket.on('unread_count', (count) => updateBell(count));
//
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
@WebSocketGateway({
  // DEPLOYMENT: Replace with your frontend domain when deploying
  cors: {
    origin:
      process.env.NODE_ENV === 'production'
        ? (process.env.FRONTEND_URL ?? 'https://devscript.com')
        : 'http://localhost:3000',
    credentials: true,
  },
  // WebSocket path — frontend connects to this
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  declare server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  // Map of userId → Set of socketIds
  // One user can have multiple connections (phone + laptop)
  // We use a Map so lookup is O(1)
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server): void {
    this.logger.log('WebSocket Gateway initialized');

    // DEPLOYMENT (AWS STEP 3): Initialize Redis adapter here
    // See comment block above for full Redis adapter setup
    void server;
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      // Extract JWT from handshake auth or query param
      // Frontend sends: io('/notifications', { auth: { token: 'Bearer xxx' } })
      const rawToken =
        (client.handshake.auth as Record<string, string>)['token'] ??
        (client.handshake.query['token'] as string);

      if (!rawToken) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      // Strip 'Bearer ' prefix if present
      const token = rawToken.replace(/^Bearer\s+/i, '');

      // Verify JWT — same secret as HTTP auth
      const payload = this.jwtService.verify<{
        sub: string;
        email: string;
        type: string;
      }>(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      // Only accept access tokens — not refresh tokens
      if (payload.type !== 'access') {
        client.disconnect();
        return;
      }

      const userId = payload.sub;

      // Store socket ID under this user
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      // Store userId on the socket for easy lookup on disconnect
      client.data = { userId };

      // Join a room named after userId — makes broadcasting to user easy
      await client.join(`user:${userId}`);

      this.logger.log(`User ${userId} connected — socket ${client.id}`);
    } catch {
      // Invalid or expired token
      this.logger.warn(`Client ${client.id} rejected — invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = (client.data as { userId?: string }).userId;

    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        // Clean up map entry if user has no more connections
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
      this.logger.log(`User ${userId} disconnected — socket ${client.id}`);
    }
  }

  // ─── Client → Server events ───────────────────────────────────────────────

  // Client can ask to mark a notification as read via WebSocket
  // This is optional — you can also use the REST endpoint
  @SubscribeMessage('mark_read')
  handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { notificationId: string },
  ): void {
    const userId = (client.data as { userId?: string }).userId;
    this.logger.log(
      `User ${userId} marked notification ${data.notificationId} as read`,
    );
    // Actual DB update handled by NotificationsService via REST/GraphQL
    // Here we just acknowledge receipt
    client.emit('mark_read_ack', { notificationId: data.notificationId });
  }

  // ─── Server → Client methods (called by NotificationsService) ────────────

  // Push a notification to a specific user — all their connected devices
  sendNotificationToUser(
    userId: string,
    notification: {
      _id: string;
      type: string;
      message: string;
      postId?: string;
      commentId?: string;
      actor?: { name: string; avatarUrl?: string };
      createdAt: Date;
    },
  ): void {
    // Emit to the user's room — all their sockets receive it
    this.server.to(`user:${userId}`).emit('notification', notification);

    this.logger.log(
      `Notification sent to user ${userId}: ${notification.message}`,
    );
  }

  // Push updated unread count to a user
  sendUnreadCount(userId: string, count: number): void {
    this.server.to(`user:${userId}`).emit('unread_count', { count });
  }

  // Broadcast to all connected users (e.g. platform announcements)
  // DEPLOYMENT: Useful for system-wide alerts on AWS
  broadcastToAll(event: string, data: unknown): void {
    this.server.emit(event, data);
  }

  // Check if a user is currently online
  isUserOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return sockets !== null && sockets !== undefined && sockets.size > 0;
  }

  // Get count of currently connected users
  // DEPLOYMENT: Useful for monitoring dashboards on AWS CloudWatch
  getConnectedUsersCount(): number {
    return this.userSockets.size;
  }
}
