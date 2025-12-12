# Technical Architecture: Google Sign-In

## System Architecture

### High-Level Overview
```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Frontend   │─────▶│   Backend    │─────▶│   Google     │
│   (React)    │◀─────│  (Express)   │◀─────│   OAuth API  │
└──────────────┘      └──────────────┘      └──────────────┘
       │                      │
       │                      │
       ▼                      ▼
┌──────────────┐      ┌──────────────┐
│  LocalStorage│      │   Database   │
│  (JWT Token) │      │  (User Data) │
└──────────────┘      └──────────────┘
```

## Technology Stack

### Frontend
- **Framework:** React 18.x
- **OAuth Library:** @react-oauth/google 0.11.x
- **State Management:** React Context API
- **HTTP Client:** Axios 1.x
- **Routing:** React Router v6

### Backend
- **Runtime:** Node.js 20.x
- **Framework:** Express.js 4.x
- **Authentication:** Passport.js with passport-google-oauth20
- **Session:** express-session with connect-redis
- **JWT:** jsonwebtoken 9.x

### Database
- **Primary:** PostgreSQL 15.x
- **Session Store:** Redis 7.x
- **ORM:** Prisma 5.x

## Data Models

### User Schema (PostgreSQL)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  google_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  picture_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);

CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_email ON users(email);
```

### Session Schema (Redis)
```
Key: sess:{sessionId}
Value: {
  userId: UUID,
  googleId: string,
  email: string,
  expiresAt: timestamp
}
TTL: 30 days
```

## API Endpoints

### POST /api/auth/google
**Description:** Initiate Google OAuth flow  
**Request:** None  
**Response:**
```json
{
  "redirectUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

### GET /api/auth/google/callback
**Description:** Handle OAuth callback from Google  
**Query Params:**
- `code`: Authorization code from Google
- `state`: CSRF token

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "picture": "https://..."
  }
}
```

### GET /api/auth/me
**Description:** Get current user profile  
**Headers:** `Authorization: Bearer {token}`  
**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "picture": "https://...",
  "lastLoginAt": "2024-01-15T10:30:00Z"
}
```

### POST /api/auth/logout
**Description:** End user session  
**Headers:** `Authorization: Bearer {token}`  
**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Security Implementation

### OAuth Flow
1. Generate CSRF state token
2. Store state in session
3. Redirect to Google with state
4. Verify state on callback
5. Exchange code for tokens
6. Verify ID token signature
7. Create/update user record
8. Generate JWT
9. Return to client

### Token Management
- **Access Token:** JWT with 1 hour expiration
- **Refresh Token:** Stored in Redis, 30 day expiration
- **Token Payload:**
```json
{
  "sub": "userId",
  "email": "user@example.com",
  "iat": 1234567890,
  "exp": 1234571490
}
```

### CSRF Protection
- Use `crypto.randomBytes(32)` for state generation
- Store state in session with 5-minute expiration
- Verify state matches on callback

### Rate Limiting
- 10 requests per minute per IP for auth endpoints
- 100 requests per hour for authenticated endpoints

## Error Handling

### Frontend Errors
```typescript
enum AuthError {
  NETWORK_ERROR = 'NETWORK_ERROR',
  OAUTH_CANCELLED = 'OAUTH_CANCELLED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  SERVER_ERROR = 'SERVER_ERROR'
}
```

### Backend Errors
```typescript
class AuthenticationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message);
  }
}
```

## Monitoring & Logging

### Metrics to Track
- OAuth success rate
- Authentication latency (p50, p95, p99)
- Failed authentication attempts
- Token refresh rate
- Active sessions count

### Log Events
- User sign-in
- User sign-out
- Failed authentication attempts
- Token refreshes
- OAuth errors

## Testing Strategy

### Unit Tests
- OAuth state generation and validation
- JWT token generation and validation
- User model CRUD operations
- Error handling logic

### Integration Tests
- Full OAuth flow (mocked Google API)
- Session creation and validation
- Token refresh flow
- Logout flow

### E2E Tests
- Complete sign-in flow
- Session persistence across page reloads
- Error handling for network failures
- Multiple concurrent sign-ins

## Deployment Considerations

### Environment Variables
```bash
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
JWT_SECRET=your_jwt_secret
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@localhost:5432/db
SESSION_SECRET=your_session_secret
FRONTEND_URL=http://localhost:3000
```

### Infrastructure
- **Database:** AWS RDS PostgreSQL
- **Cache:** AWS ElastiCache Redis
- **Backend:** AWS ECS or Lambda
- **Frontend:** Vercel or Cloudflare Pages

## Performance Optimization
- Cache user profiles in Redis (5 minute TTL)
- Use connection pooling for PostgreSQL
- Implement CDN for static assets
- Compress JWT payload
- Use HTTP/2 for API calls

