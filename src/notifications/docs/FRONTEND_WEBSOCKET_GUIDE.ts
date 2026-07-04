// ─────────────────────────────────────────────────────────────────────────────
// How to connect to the WebSocket notification system from Next.js frontend
// Only relevant after deploying to AWS/VPS and enabling the gateway
// ─────────────────────────────────────────────────────────────────────────────

/*
STEP 1 — Install socket.io client in your Next.js project:
  npm install socket.io-client

STEP 2 — Create a notification hook:

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface Notification {
  _id: string;
  type: string;
  message: string;
  postId?: string;
  commentId?: string;
  createdAt: string;
}

export function useNotifications(
  accessToken: string | null,
  onNotification: (n: Notification) => void,
  onUnreadCount: (count: number) => void,
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    // Connect to your backend WebSocket
    const socket = io(`${process.env.NEXT_PUBLIC_API_URL}/notifications`, {
      auth: { token: `Bearer ${accessToken}` },
      transports: ['websocket'], // skip HTTP polling, go straight to WS
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to notification stream');
    });

    // New notification pushed by server
    socket.on('notification', (data: Notification) => {
      onNotification(data);
    });

    // Unread count updated (after mark as read, new notification, etc)
    socket.on('unread_count', ({ count }: { count: number }) => {
      onUnreadCount(count);
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection failed:', error.message);
    });

    // Cleanup on unmount or token change
    return () => {
      socket.disconnect();
    };
  }, [accessToken]);

  // Method to mark notification as read via WebSocket
  const markRead = (notificationId: string) => {
    socketRef.current?.emit('mark_read', { notificationId });
  };

  return { markRead };
}

STEP 3 — Use the hook in your layout:

export default function Layout({ children }) {
  const { accessToken } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  const { markRead } = useNotifications(
    accessToken,
    (notification) => {
      setNotifications(prev => [notification, ...prev]);
      // Show a toast notification
      toast(notification.message);
    },
    (count) => setUnreadCount(count),
  );

  return (
    <div>
      <NotificationBell count={unreadCount} />
      {children}
    </div>
  );
}
*/
