# Engineer Output
## User Profile Management - Technical Analysis

**Project ID:** 011  
**Engineer:** Software Architect Agent  
**Date:** January 15, 2024

---

## Architecture Overview

The User Profile Management system follows a standard three-tier architecture with a React frontend, Node.js/Express backend API, and PostgreSQL database. Profile images are stored in AWS S3 with CloudFront CDN for fast delivery. The system integrates with the existing authentication service and email notification system.

### System Components

1. **Frontend (React)**
   - Profile settings SPA
   - Form validation and state management
   - Image upload with client-side preprocessing
   - Real-time validation feedback

2. **Backend API (Node.js/Express)**
   - RESTful API endpoints
   - Multer for file uploads
   - Sharp for image processing
   - Rate limiting middleware
   - Email service integration

3. **Database (PostgreSQL)**
   - User profiles table (extended)
   - Notification preferences table
   - Privacy settings table
   - Audit log table

4. **Storage (AWS S3)**
   - Profile images bucket
   - Public read access via CloudFront
   - Lifecycle policies for deleted accounts

---

## Data Model Design

### Extended Users Table

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
```

### New Tables

**profile_privacy_settings**
- user_id (FK to users.id)
- field_name (enum: email, bio, location, website, profile_picture)
- is_public (boolean)
- updated_at (timestamp)

**notification_preferences**
- user_id (FK to users.id)
- channel (enum: email, push, sms)
- category (enum: account_activity, product_updates, marketing, messages, updates)
- enabled (boolean)
- updated_at (timestamp)

**profile_audit_log**
- id (primary key)
- user_id (FK to users.id)
- action (enum: profile_updated, password_changed, privacy_changed, picture_uploaded, account_deletion_requested)
- changes_json (jsonb)
- ip_address (varchar)
- user_agent (text)
- created_at (timestamp)

---

## API Endpoints

### Profile Management

**GET /api/profile**
- Fetch current user's profile
- Returns: user profile with privacy settings
- Auth: Required

**PATCH /api/profile**
- Update profile fields
- Body: { full_name, email, bio, location, website }
- Validation: email uniqueness, field lengths
- Rate limit: 10 requests per hour
- Auth: Required

**GET /api/profile/:userId/public**
- Fetch public profile of any user
- Respects privacy settings
- Auth: Optional (affects what fields are visible)

### Profile Picture

**POST /api/profile/picture**
- Upload profile picture
- Body: multipart/form-data with image file
- Validation: file size (5MB max), format (jpg/png/webp)
- Process: client resize to 800px → server resize to 400px → upload to S3
- Rate limit: 5 requests per hour
- Auth: Required

**DELETE /api/profile/picture**
- Remove profile picture
- Deletes from S3 and database
- Auth: Required

### Privacy Settings

**GET /api/profile/privacy**
- Fetch privacy settings for all fields
- Returns: array of field privacy settings
- Auth: Required

**PATCH /api/profile/privacy**
- Update privacy settings
- Body: { field_name, is_public }
- Cache invalidation on change
- Auth: Required

### Notification Preferences

**GET /api/profile/notifications**
- Fetch all notification preferences
- Returns: grouped by channel
- Auth: Required

**PATCH /api/profile/notifications**
- Update notification preferences
- Body: { channel, category, enabled }
- Auto-saves without confirmation
- Auth: Required

**POST /api/profile/notifications/test**
- Send test notification
- Body: { channel }
- Validates preferences are set correctly
- Auth: Required

### Password Management

**POST /api/profile/password**
- Change password
- Body: { current_password, new_password, new_password_confirm }
- Validation: password strength requirements
- Side effects: invalidate all sessions except current, send email notification
- Rate limit: 3 requests per hour
- Auth: Required

### Account Deletion

**POST /api/profile/delete-request**
- Request account deletion
- Body: { password }
- Side effects: set deletion_requested_at timestamp, send confirmation email
- Grace period: 30 days
- Auth: Required

**POST /api/profile/cancel-deletion**
- Cancel pending account deletion
- Clears deletion_requested_at timestamp
- Auth: Required

**POST /api/profile/export-data**
- Export user data (GDPR compliance)
- Returns: ZIP file with JSON data
- Rate limit: 1 request per day
- Auth: Required

---

## Security Considerations

### Input Validation
- All user inputs sanitized to prevent XSS
- SQL injection prevention via parameterized queries
- File upload validation: magic number check, not just extension
- Email validation: RFC 5322 compliance

### Authentication
- All endpoints require valid JWT token
- Password change requires re-authentication
- Session tokens invalidated after password change

### Rate Limiting
- Profile updates: 10 per hour
- Password changes: 3 per hour
- Picture uploads: 5 per hour
- Export data: 1 per day
- Implemented via redis-based rate limiter

### Image Security
- Virus/malware scanning on upload (ClamAV)
- Content moderation API for inappropriate images
- Signed S3 URLs with expiration for uploads
- Public read-only access via CloudFront

### Privacy
- Field-level privacy controls enforced at API level
- Public profile endpoint respects privacy settings
- Audit log for all profile changes
- GDPR-compliant data export and deletion

---

## Performance Optimizations

### Caching Strategy
- Profile data: Redis cache, 5-minute TTL, invalidate on update
- Privacy settings: Redis cache, 1-hour TTL, invalidate on change
- Public profiles: CloudFront CDN, 1-hour TTL
- Profile pictures: CloudFront CDN, 24-hour TTL

### Database Optimization
- Indexes on users.email (unique)
- Indexes on profile_privacy_settings (user_id, field_name)
- Indexes on notification_preferences (user_id, channel, category)
- Composite index for soft-deleted users (deleted_at IS NULL)

### Image Processing
- Client-side resize to 800px before upload (reduce bandwidth)
- Server-side resize to 400px (Sharp library, WebP format)
- Generate multiple sizes: 400px, 200px, 100px, 40px
- Lazy loading for profile pictures in lists

### API Response Times
- Target: < 200ms for profile fetch
- Target: < 500ms for profile update
- Target: < 3s for image upload (excluding network)

---

## Error Handling

### User-Facing Errors
- 400: Validation errors (detailed field-level messages)
- 401: Authentication required
- 403: Unauthorized (e.g., can't edit another user's profile)
- 409: Conflict (e.g., email already in use)
- 413: File too large
- 415: Unsupported media type
- 429: Rate limit exceeded
- 500: Server error (log details, show generic message)

### Server-Side Error Handling
- Global error handler with winston logging
- Sentry integration for error tracking
- Graceful degradation for S3 failures
- Retry logic for email delivery (3 attempts)

---

## Testing Strategy

### Unit Tests
- Validation logic (email, password strength, file size)
- Privacy setting enforcement
- Image processing functions
- Data model transformations

### Integration Tests
- API endpoint tests with test database
- S3 upload/delete with test bucket
- Email sending with test provider
- Rate limiting with test redis

### E2E Tests
- Complete profile edit flow
- Profile picture upload flow
- Password change flow
- Account deletion flow with grace period

### Load Tests
- 1000 concurrent users updating profiles
- 500 concurrent profile picture uploads
- Sustained load: 100 req/s for 1 hour

---

## Deployment Considerations

### Database Migrations
- Backward-compatible migrations
- Run migrations before deploying new code
- Test migrations on staging with production data snapshot

### Environment Variables
```
AWS_S3_BUCKET=profile-images-prod
AWS_S3_REGION=us-east-1
CLOUDFRONT_DOMAIN=cdn.example.com
REDIS_URL=redis://...
RATE_LIMIT_WINDOW=3600000
RATE_LIMIT_MAX_PROFILE_UPDATES=10
PROFILE_PICTURE_MAX_SIZE=5242880
DELETION_GRACE_PERIOD_DAYS=30
```

### Monitoring
- CloudWatch for S3 upload/download metrics
- Redis metrics (cache hit rate)
- API response times (p50, p95, p99)
- Error rates by endpoint
- Rate limit hits

### Rollback Plan
- Feature flags for gradual rollout
- Database migration rollback scripts
- S3 bucket versioning for deleted images
- Blue-green deployment strategy

---

## Dependencies

### New Dependencies
- `multer` (^1.4.5) - File upload middleware
- `sharp` (^0.32.0) - Image processing
- `aws-sdk` (^2.1400) - S3 integration
- `express-rate-limit` (^7.0.0) - Rate limiting
- `ioredis` (^5.3.0) - Redis client for caching
- `validator` (^13.11.0) - Input validation
- `zxcvbn` (^4.4.2) - Password strength checking

### Existing Dependencies
- `express` - Web framework
- `jsonwebtoken` - JWT authentication
- `bcrypt` - Password hashing
- `pg` - PostgreSQL client
- `nodemailer` - Email sending

---

## Technical Debt & Future Improvements

### Known Limitations
- Single S3 bucket region (no multi-region support)
- Synchronous image processing (could be async with queue)
- No profile activity history for users
- No undo/rollback for profile changes

### Future Enhancements
- WebP format support with fallback for old browsers
- Gravatar integration as profile picture option
- Two-factor authentication management in settings
- Profile completion percentage indicator
- Bulk privacy setting changes (all public/all private)

---

*Technical analysis prepared by: Software Architect Agent*  
*Reviewed by: Engineering Lead*  
*Date: January 15, 2024*

