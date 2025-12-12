# Technical Architecture: Notification System

## System Architecture

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Frontend   │─────▶│   Backend    │─────▶│   SendGrid   │
│   (React)    │◀─────│  (Express)   │      │   (Email)    │
└──────────────┘      └──────────────┘      └──────────────┘
       │                      │
       │ WebSocket           │
       │                      ├──────────────▶┌──────────────┐
       ▼                      │                │   Firebase   │
┌──────────────┐             │                │   (Push)     │
│   Socket.io  │◀────────────┘                └──────────────┘
└──────────────┘                                      
                                              ┌──────────────┐
                                              │  PostgreSQL  │
                                              │  (Storage)   │
                                              └──────────────┘
                                              
                                              ┌──────────────┐
                                              │    Redis     │
                                              │   (Queue)    │
                                              └──────────────┘
```

## Technology Stack

### Frontend
- React 18.x with TypeScript
- Socket.io-client for real-time
- React Query for data fetching
- Framer Motion for animations

### Backend
- Node.js 20.x
- Express.js 4.x
- Socket.io for WebSocket
- Bull (Redis-based queue)
- SendGrid SDK
- Firebase Admin SDK

### Database
- PostgreSQL for notifications
- Redis for queue and caching

## API Endpoints

### GET /api/notifications
Get user's notifications (paginated)

### PATCH /api/notifications/:id/read
Mark notification as read

### POST /api/notifications/read-all
Mark all as read

### GET /api/notifications/preferences
Get user preferences

### PUT /api/notifications/preferences
Update user preferences

### POST /api/notifications/send (Admin)
Send notification to users

## WebSocket Events

### Client → Server
- `subscribe`: Subscribe to user's notification channel
- `mark_read`: Mark notification as read

### Server → Client
- `new_notification`: New notification received
- `notification_read`: Notification marked as read
- `notifications_cleared`: All notifications marked as read

## Queue System

Uses Bull with Redis for reliable message delivery:
- `email-queue`: Email notifications (retry 3 times)
- `push-queue`: Push notifications (retry 2 times)
- Queue processor runs every 5 seconds
- Failed jobs moved to failed queue for investigation

## Performance
- WebSocket connections: Support 10,000 concurrent
- Notification throughput: 10,000/minute
- Database queries: Indexed on user_id and created_at
- Cache unread count in Redis (30 second TTL)

