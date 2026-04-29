import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';

let socket: Socket | null = null;

export function getSocket(token?: string): Socket {
  const t = token ?? getAccessToken() ?? '';
  if (socket?.connected) return socket;
  socket = io(import.meta.env.VITE_API_URL ?? '', {
    auth: { token: t },
    transports: ['polling', 'websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
