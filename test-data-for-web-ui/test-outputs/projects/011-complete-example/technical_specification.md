# Technical Specification
## User Profile Management

**Project ID:** 011  
**Version:** 1.0  
**Last Updated:** January 15, 2024

---

## 1. Data Model

### Database Schema Changes

#### Users Table (Extended)
```sql
-- Extend existing users table
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN location VARCHAR(100);
ALTER TABLE users ADD COLUMN website VARCHAR(255);
ALTER TABLE users ADD COLUMN profile_picture_url VARCHAR(500);
ALTER TABLE users ADD COLUMN profile_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN deletion_requested_at TIMESTAMP;
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP;

-- Add index for soft-deleted users
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;
```

#### Profile Privacy Settings
```sql
CREATE TABLE profile_privacy_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  field_name VARCHAR(50) NOT NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, field_name)
);

CREATE INDEX idx_privacy_user_field ON profile_privacy_settings(user_id, field_name);
```

**Field Names Enum:**
- `email`
- `bio`
- `location`
- `website`
- `profile_picture`

#### Notification Preferences
```sql
CREATE TABLE notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL,
  category VARCHAR(50) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, channel, category)
);

CREATE INDEX idx_notif_pref_user ON notification_preferences(user_id);
CREATE INDEX idx_notif_pref_enabled ON notification_preferences(enabled) WHERE enabled = true;
```

**Channel Enum:** `email`, `push`, `sms`  
**Category Enum:** `account_activity`, `product_updates`, `marketing`, `messages`, `updates`

#### Profile Audit Log
```sql
CREATE TABLE profile_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  changes_json JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user_id ON profile_audit_log(user_id);
CREATE INDEX idx_audit_created_at ON profile_audit_log(created_at DESC);
CREATE INDEX idx_audit_action ON profile_audit_log(action);
```

**Action Enum:**
- `profile_updated`
- `password_changed`
- `privacy_changed`
- `picture_uploaded`
- `picture_removed`
- `account_deletion_requested`
- `account_deletion_cancelled`

---

## 2. API Specification

### Base URL
`/api/v1/profile`

### Authentication
All endpoints require JWT Bearer token in Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Endpoints

#### GET /api/v1/profile
**Description:** Fetch current user's profile  
**Auth:** Required  
**Response:**
```json
{
  "id": 123,
  "full_name": "John Doe",
  "email": "john@example.com",
  "bio": "Software engineer...",
  "location": "San Francisco, CA",
  "website": "https://johndoe.com",
  "profile_picture_url": "https://cdn.example.com/...",
  "profile_updated_at": "2024-01-15T10:30:00Z",
  "privacy_settings": {
    "email": false,
    "bio": true,
    "location": true,
    "website": true,
    "profile_picture": true
  }
}
```

#### PATCH /api/v1/profile
**Description:** Update profile information  
**Auth:** Required  
**Rate Limit:** 10 requests per hour  
**Body:**
```json
{
  "full_name": "John Doe",
  "email": "john@example.com",
  "bio": "Updated bio...",
  "location": "New York, NY",
  "website": "https://newsite.com"
}
```
**Response:** Updated profile object  
**Errors:**
- 400: Validation error
- 409: Email already in use
- 429: Rate limit exceeded

#### POST /api/v1/profile/picture
**Description:** Upload profile picture  
**Auth:** Required  
**Rate Limit:** 5 requests per hour  
**Content-Type:** multipart/form-data  
**Body:** `image` file (jpg/png/webp, max 5MB)  
**Response:**
```json
{
  "profile_picture_url": "https://cdn.example.com/...",
  "sizes": {
    "large": "https://cdn.example.com/.../400.webp",
    "medium": "https://cdn.example.com/.../200.webp",
    "small": "https://cdn.example.com/.../100.webp",
    "thumb": "https://cdn.example.com/.../40.webp"
  }
}
```
**Errors:**
- 413: File too large
- 415: Unsupported media type
- 429: Rate limit exceeded

#### DELETE /api/v1/profile/picture
**Description:** Remove profile picture  
**Auth:** Required  
**Response:** 204 No Content

#### GET /api/v1/profile/privacy
**Description:** Get privacy settings  
**Auth:** Required  
**Response:**
```json
{
  "settings": [
    { "field_name": "email", "is_public": false },
    { "field_name": "bio", "is_public": true },
    { "field_name": "location", "is_public": true },
    { "field_name": "website", "is_public": true },
    { "field_name": "profile_picture", "is_public": true }
  ]
}
```

#### PATCH /api/v1/profile/privacy
**Description:** Update privacy settings  
**Auth:** Required  
**Body:**
```json
{
  "field_name": "email",
  "is_public": false
}
```
**Response:** 200 OK with updated settings

#### GET /api/v1/profile/notifications
**Description:** Get notification preferences  
**Auth:** Required  
**Response:**
```json
{
  "email": [
    { "category": "account_activity", "enabled": true },
    { "category": "product_updates", "enabled": true },
    { "category": "marketing", "enabled": false }
  ],
  "push": [
    { "category": "messages", "enabled": true },
    { "category": "updates", "enabled": true }
  ]
}
```

#### PATCH /api/v1/profile/notifications
**Description:** Update notification preference  
**Auth:** Required  
**Body:**
```json
{
  "channel": "email",
  "category": "marketing",
  "enabled": false
}
```
**Response:** 200 OK

#### POST /api/v1/profile/password
**Description:** Change password  
**Auth:** Required  
**Rate Limit:** 3 requests per hour  
**Body:**
```json
{
  "current_password": "oldpass123",
  "new_password": "NewP@ss456",
  "new_password_confirm": "NewP@ss456"
}
```
**Response:** 200 OK  
**Side Effects:**
- Invalidate all sessions except current
- Send email notification  
**Errors:**
- 400: Passwords don't match or don't meet requirements
- 401: Current password incorrect
- 429: Rate limit exceeded

#### POST /api/v1/profile/delete-request
**Description:** Request account deletion  
**Auth:** Required  
**Body:**
```json
{
  "password": "currentpass"
}
```
**Response:**
```json
{
  "deletion_requested_at": "2024-01-15T10:30:00Z",
  "deletion_scheduled_for": "2024-02-14T10:30:00Z",
  "grace_period_days": 30
}
```
**Side Effects:**
- Set deletion_requested_at timestamp
- Send confirmation email with cancellation link

#### POST /api/v1/profile/cancel-deletion
**Description:** Cancel pending deletion  
**Auth:** Required  
**Response:** 200 OK  
**Side Effects:**
- Clear deletion_requested_at
- Send cancellation confirmation email

#### POST /api/v1/profile/export-data
**Description:** Export user data (GDPR)  
**Auth:** Required  
**Rate Limit:** 1 request per day  
**Response:** ZIP file download  
**Content-Type:** application/zip

#### GET /api/v1/profile/:userId/public
**Description:** Fetch public profile  
**Auth:** Optional  
**Response:** Profile object (filtered by privacy settings)

---

## 3. Implementation Notes

### Image Processing Pipeline
1. **Client-side (Browser):**
   - User selects image
   - JavaScript resizes to max 800px width (maintaining aspect ratio)
   - Convert to JPEG at 90% quality
   - Upload via multipart/form-data

2. **Server-side (Node.js + Sharp):**
   - Receive upload via Multer
   - Validate: file size, magic number check, virus scan
   - Generate 4 sizes: 400px, 200px, 100px, 40px (square crop)
   - Convert to WebP format for modern browsers
   - Upload all sizes to S3 with public-read ACL
   - Return CloudFront CDN URLs

3. **S3 Bucket Structure:**
```
profile-images/
  ├── {user_id}/
  │   ├── large.webp (400x400)
  │   ├── medium.webp (200x200)
  │   ├── small.webp (100x100)
  │   └── thumb.webp (40x40)
```

### Validation Rules

**Email:**
- RFC 5322 compliant
- Unique across all users
- Max 255 characters

**Full Name:**
- Min 2 characters
- Max 100 characters
- Unicode support for international names

**Bio:**
- Max 500 characters
- Plain text (HTML stripped)
- URLs allowed

**Location:**
- Max 100 characters
- Free-form text

**Website:**
- Valid URL format
- HTTPS preferred
- Max 255 characters

**Password:**
- Min 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character
- Checked against common password lists (zxcvbn)

### Session Management

**JWT Token Structure:**
```json
{
  "user_id": 123,
  "email": "john@example.com",
  "session_id": "uuid-v4",
  "iat": 1705315800,
  "exp": 1705402200
}
```

**Password Change Flow:**
1. User submits password change request
2. Verify current password via bcrypt
3. Hash new password with bcrypt (12 rounds)
4. Update users table
5. Delete all sessions except current from sessions table
6. Send email notification
7. Log to audit table

### Caching Strategy

**Redis Keys:**
- `profile:{user_id}` → Full profile object (5 min TTL)
- `privacy:{user_id}` → Privacy settings (1 hour TTL)
- `notif_prefs:{user_id}` → Notification prefs (1 hour TTL)
- `public_profile:{user_id}` → Public profile (1 hour TTL)

**Cache Invalidation:**
- Profile updated → Invalidate `profile:{user_id}` and `public_profile:{user_id}`
- Privacy changed → Invalidate `privacy:{user_id}` and `public_profile:{user_id}`
- Picture uploaded → Invalidate all profile keys + CloudFront invalidation

---

## 4. Architecture Notes

### Frontend Components

**Pages:**
- `ProfileSettingsPage` - Main container with tab routing
  - `ProfileTab` - Personal information form
  - `PrivacyTab` - Privacy controls
  - `NotificationsTab` - Notification preferences
  - `PasswordTab` - Password change form

**Components:**
- `ProfileForm` - Edit/view mode for personal info
- `AvatarUpload` - Profile picture with crop modal
- `PrivacyToggle` - Field-level privacy control
- `NotificationToggle` - Preference toggle with description
- `PasswordStrengthMeter` - Visual password strength indicator
- `DeleteAccountModal` - Multi-step confirmation

**State Management (React Context/Redux):**
```javascript
profileState = {
  profile: {...},
  privacy: {...},
  notifications: {...},
  isLoading: boolean,
  errors: {...},
  unsavedChanges: boolean
}
```

### Backend Architecture

**Controllers:**
- `ProfileController` - CRUD operations
- `PrivacyController` - Privacy settings
- `NotificationController` - Notification prefs
- `PasswordController` - Password changes
- `DeletionController` - Account deletion

**Services:**
- `ProfileService` - Business logic
- `ImageProcessingService` - Sharp wrapper
- `S3Service` - AWS SDK wrapper
- `EmailService` - Notification emails
- `AuditService` - Audit logging

**Middleware:**
- `authenticate` - JWT verification
- `rateLimit` - Express-rate-limit
- `validateProfile` - Input validation
- `cacheProfile` - Redis caching
- `auditLog` - Audit logging

### Database Query Optimization

**Profile Fetch (with privacy):**
```sql
SELECT u.*, 
  json_object_agg(p.field_name, p.is_public) as privacy_settings
FROM users u
LEFT JOIN profile_privacy_settings p ON p.user_id = u.id
WHERE u.id = $1 AND u.deleted_at IS NULL
GROUP BY u.id;
```

**Public Profile Fetch:**
```sql
SELECT u.id, u.full_name, u.profile_picture_url,
  CASE WHEN p_email.is_public THEN u.email END as email,
  CASE WHEN p_bio.is_public THEN u.bio END as bio,
  CASE WHEN p_location.is_public THEN u.location END as location,
  CASE WHEN p_website.is_public THEN u.website END as website
FROM users u
LEFT JOIN profile_privacy_settings p_email ON p_email.user_id = u.id AND p_email.field_name = 'email'
LEFT JOIN profile_privacy_settings p_bio ON p_bio.user_id = u.id AND p_bio.field_name = 'bio'
LEFT JOIN profile_privacy_settings p_location ON p_location.user_id = u.id AND p_location.field_name = 'location'
LEFT JOIN profile_privacy_settings p_website ON p_website.user_id = u.id AND p_website.field_name = 'website'
WHERE u.id = $1 AND u.deleted_at IS NULL;
```

---

## 5. Non-Functional Requirements

### Performance
- Profile page load: < 2s on 3G connection
- API response time (p95): < 500ms
- Image upload processing: < 3s
- Cache hit rate: > 80%

### Scalability
- Support 100,000 concurrent users
- Handle 1,000 profile updates per minute
- Handle 500 image uploads per minute
- Database connection pooling: 20-50 connections

### Security
- All API endpoints require authentication
- Rate limiting on all mutation endpoints
- Input validation and sanitization
- SQL injection prevention via parameterized queries
- XSS prevention via output escaping
- CSRF protection via tokens
- Image malware scanning
- HTTPS required for all requests

### Availability
- 99.9% uptime SLA
- Graceful degradation if S3 unavailable
- Circuit breaker for email service
- Health check endpoint: `/api/health`

### Monitoring
- Application metrics (APM)
- Error tracking (Sentry)
- Log aggregation (CloudWatch/ELK)
- Database query performance monitoring
- S3 upload/download metrics
- Cache hit/miss ratios

---

## 6. Testing Strategy

### Unit Tests (Jest)
- Validation functions
- Privacy logic
- Image processing utilities
- Data transformations
- Password hashing

**Coverage Target:** 80%

### Integration Tests (Supertest)
- API endpoints with test database
- Authentication flows
- Rate limiting behavior
- Email sending (with mock service)
- S3 operations (with LocalStack)

**Coverage Target:** 70%

### E2E Tests (Playwright)
- Complete profile edit flow
- Profile picture upload
- Privacy settings changes
- Password change flow
- Account deletion with grace period

**Critical Paths:** 5 tests

### Load Tests (k6)
- 1,000 concurrent profile fetches
- 500 concurrent profile updates
- 100 concurrent image uploads
- Sustained load: 100 req/s for 1 hour

**Success Criteria:**
- p95 response time < 1s
- Error rate < 1%
- No memory leaks

---

## 7. Rabbit Holes to Avoid

### ❌ Over-engineered Privacy System
**Risk:** Attempting to build role-based access control (RBAC) or complex permission system  
**Solution:** Keep it simple - just public/private toggle per field  
**Why:** User research shows users want simple privacy controls, not complex permission matrices

### ❌ Real-time Profile Sync
**Risk:** Building WebSocket-based real-time profile updates across devices  
**Solution:** Use cache invalidation with short TTLs (5 min)  
**Why:** Profile updates are infrequent; real-time sync adds significant complexity

### ❌ Advanced Image Editing
**Risk:** Building in-app image editor with filters, adjustments, etc.  
**Solution:** Simple crop-to-square only, users edit in native apps  
**Why:** Replicating photo editing software is out of scope

### ❌ Profile Version History
**Risk:** Maintaining full history of every profile change for rollback  
**Solution:** Audit log only (for security), no user-facing rollback  
**Why:** Adds storage costs and complexity; users rarely need this

### ❌ Custom Email Templates
**Risk:** Building custom template engine for notification emails  
**Solution:** Use existing email service's templates  
**Why:** Email template engines are complex; use existing solution

### ❌ Profile Analytics
**Risk:** Building analytics dashboard for profile views, popularity, etc.  
**Solution:** Basic audit log only, no analytics  
**Why:** Analytics is a separate feature set; don't conflate concerns

---

*Technical Specification prepared by: Engineering Team*  
*Approved by: Technical Lead*  
*Last Updated: January 15, 2024*

