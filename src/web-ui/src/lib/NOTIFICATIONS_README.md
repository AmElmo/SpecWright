    # Browser Tab Notifications

Simple, lightweight notification system for SpecWright that alerts users when file watching completes.

## Features

### 1. **Tab Title Updates**
- When files are updated while the tab is in the background, the tab title flashes with "✅ Updated"
- Flashes every 1.5 seconds to catch attention
- Automatically clears when you return to the tab

### 2. **Notification Sound**
- Plays a subtle two-tone sound (C5 → E5) when updates happen in the background
- Uses Web Audio API (no audio files needed)
- Very brief (~300ms total) to avoid being annoying
- Only plays when tab is not focused

### 3. **Smart Behavior**
- **Notifications only trigger when tab is in background** (`document.hidden === true`)
- If you're actively viewing the page, no notification (you can already see the updates)
- Automatically clears notification when you return to the tab

## Usage

### Automatic (Already Set Up)

The `useRealtimeUpdates` hook automatically handles notifications:

```tsx
import { useRealtimeUpdates } from '../lib/use-realtime';

function MyComponent() {
  useRealtimeUpdates(() => {
    // Your update handler (refresh data, etc.)
    fetchStatus();
  });
}
```

### Manual Control (Advanced)

You can also manually trigger notifications:

```tsx
import { 
  playNotificationSound, 
  notifyInTab, 
  clearTabNotification 
} from '../lib/use-realtime';

// Play the notification sound
playNotificationSound();

// Update tab title with custom message
notifyInTab('🎉 Task Complete');

// Clear notification
clearTabNotification();
```

## How It Works

### WebSocket Flow
1. Server detects file changes via `chokidar` watcher
2. Server broadcasts WebSocket message: `{ type: 'file_changed', path: '...' }`
3. Client receives message in `useRealtimeUpdates` hook
4. If tab is hidden (`document.hidden === true`):
   - Play notification sound
   - Start flashing tab title
5. When user returns to tab (`visibilitychange` event):
   - Stop flashing
   - Restore original title

### Sound Generation
Uses Web Audio API to generate tones programmatically:
- No external audio files needed
- Two sine wave tones (523Hz and 659Hz)
- Smooth fade in/out envelope to avoid clicks
- Total duration: ~300ms

### Title Flashing
- Stores original title on first notification
- Uses `setInterval` to alternate between "✅ Updated - SpecWright" and original title
- Cleans up interval on visibility change or unmount

## Testing

### Test Notifications Manually
Open the browser console and run:

```javascript
// Test sound
import { playNotificationSound } from './lib/use-realtime';
playNotificationSound();

// Test title notification
import { notifyInTab } from './lib/use-realtime';
notifyInTab('🧪 Test Notification');
```

### Test During Development
1. Start the web server: `npm run dev`
2. Open SpecWright in browser
3. Start a specification phase (e.g., "Generate PM Questions")
4. **Switch to Cursor or another app** while AI is working
5. When file updates complete:
   - You'll hear two quick tones
   - Browser tab will show "✅ Updated - SpecWright" (flashing)
6. Switch back to the tab - notification clears automatically

## Future Enhancements

Possible additions (not yet implemented):
- Native OS notifications (requires user permission)
- Server-side notifications via `node-notifier`
- Customizable sound preferences
- Different notification types (success, warning, error)
- Notification history panel

## Browser Compatibility

- **Tab Title**: Works in all modern browsers
- **Web Audio API**: Supported in Chrome, Firefox, Safari, Edge (not IE)
- **Visibility API**: Supported in all modern browsers
- **Fallback**: If Web Audio fails, only tab title notification shows (graceful degradation)

