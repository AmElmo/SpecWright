# Design Brief: Notification System

## Design Goals
Create an unobtrusive yet attention-grabbing notification system that respects user preferences.

## Screen Inventory

### 1. Notification Bell Icon
**Location:** Top navigation bar  
**States:**
- No notifications: Gray bell icon
- Unread notifications: Blue bell with red badge showing count
- Badge shows "99+" for counts over 99

### 2. Notification Panel
**Trigger:** Clicking bell icon  
**Appearance:** Dropdown panel, 400px wide, max 500px height  
**Sections:**
- Header: "Notifications" with "Mark all as read" link
- List: Scrollable notification items
- Footer: "See all notifications" link

### 3. Notification Item
**Layout:**
- Icon on left (type-specific: 🔔 system, 👤 user, 📝 content)
- Title and message in center
- Timestamp on right (e.g., "2m ago")
- Blue background for unread, white for read
- Hover effect: Slight shadow

### 4. Notification Settings Page
**Layout:**
- Toggle switches for each notification type
- Channel selection (in-app, email, push)
- Quiet hours time picker
- Save button at bottom

## Visual Design
- Primary color: #3B82F6 (Blue)
- Unread background: #EFF6FF (Light blue)
- Read background: #FFFFFF (White)
- Badge: #EF4444 (Red)

## Interaction Patterns
- Click bell → Panel slides down with animation
- Click notification → Marks as read, navigates to link
- Click outside → Panel closes
- Real-time: New notification slides in from top with bounce animation

