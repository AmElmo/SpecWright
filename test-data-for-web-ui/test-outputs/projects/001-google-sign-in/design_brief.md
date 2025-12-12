# Design Brief: Google Sign-In

## Design Goals
Create a seamless, trustworthy authentication experience that follows Google's brand guidelines and our app's design system.

## Screen Inventory

### 1. Login Page
**Purpose:** Entry point for authentication  
**Components:**
- Google Sign-In button (prominent, centered)
- "Or continue with email" option below
- Terms of service and privacy policy links
- Loading state during authentication

**Wireframe:**
```
┌────────────────────────────────────┐
│                                    │
│         [App Logo]                 │
│                                    │
│     Welcome back!                  │
│                                    │
│  ┌──────────────────────────────┐ │
│  │  🔵 Sign in with Google     │ │
│  └──────────────────────────────┘ │
│                                    │
│     Or continue with email        │
│                                    │
│   [Terms] • [Privacy Policy]      │
└────────────────────────────────────┘
```

### 2. OAuth Consent (Google's Screen)
**Note:** This is handled by Google, not our app

### 3. Post-Auth Dashboard
**Purpose:** Landing page after successful authentication  
**Components:**
- Welcome message with user's name
- User avatar (from Google profile)
- Main navigation
- Quick actions

## Visual Design

### Color Palette
- Primary: #4285F4 (Google Blue)
- Secondary: #34A853 (Google Green)
- Background: #FFFFFF
- Text: #202124

### Typography
- Headings: Inter Bold, 24px
- Body: Inter Regular, 16px
- Button: Inter Medium, 14px

### Button Styles
**Google Sign-In Button:**
- Background: #4285F4
- Border: 1px solid #4285F4
- Border radius: 8px
- Padding: 12px 24px
- Google logo icon on the left
- Text: "Sign in with Google"
- Hover state: #357AE8

## Interaction Patterns

### Sign-In Flow
1. User clicks "Sign in with Google"
2. Button shows loading spinner
3. Popup/redirect to Google OAuth
4. After consent, redirect back with loading state
5. Fade in to dashboard with success animation

### Error States
- Network error: "Connection lost. Please try again."
- OAuth error: "Authentication failed. Please try again."
- Server error: "Something went wrong. Please try again later."

## Accessibility
- ARIA labels for all buttons
- Keyboard navigation support
- Screen reader announcements for state changes
- High contrast mode support
- Focus indicators visible

## Responsive Design
- Mobile: Full-width button, stack elements vertically
- Tablet: Center content, max-width 600px
- Desktop: Center content, max-width 400px

