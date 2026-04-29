import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { AuthPayload } from './middleware/auth';

let io: SocketServer;

export function initSocket(httpServer: HttpServer, frontendUrl: string) {
  const extraOrigins = [process.env.WEBHOOK_BASE_URL, process.env.EXTRA_ORIGIN].filter(Boolean) as string[];
  io = new SocketServer(httpServer, {
    cors: {
      origin: [frontendUrl, ...extraOrigins],
      credentials: true,
    },
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) { next(new Error('No token')); return; }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user as AuthPayload;
    // Each tenant gets its own room for broadcast isolation
    socket.join(`tenant:${user.tenantId}`);
    socket.join(`user:${user.userId}`);
  });

  return io;
}

export function getIo(): SocketServer {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

// Helper: emit to all connections in a tenant
export function emitToTenant(tenantId: string, event: string, data: unknown) {
  try {
    getIo().to(`tenant:${tenantId}`).emit(event, data);
  } catch {
    // Socket not initialized in tests — ignore
  }
}

// Helper: emit to a specific user's socket(s)
export function emitToUser(userId: string, event: string, data: unknown) {
  try {
    getIo().to(`user:${userId}`).emit(event, data);
  } catch {
    // Socket not initialized in tests — ignore
  }
}
