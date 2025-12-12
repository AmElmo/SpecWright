/**
 * Notification utilities for browser-based alerts
 * Handles tab title updates and notification sounds
 */

import { logger } from '../utils/logger';

let originalTitle: string | null = null;
let titleFlashInterval: number | null = null;

/**
 * Play a subtle notification sound using Web Audio API
 */
export function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create a pleasant two-tone notification sound
    const playTone = (frequency: number, startTime: number, duration: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      // Envelope: fade in and out
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + duration - 0.01);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };
    
    const now = audioContext.currentTime;
    // Two pleasant tones (C5 and E5 in musical notation)
    playTone(523.25, now, 0.15); // C5
    playTone(659.25, now + 0.15, 0.15); // E5
    
  } catch (error) {
    logger.warn('Could not play notification sound:', error);
  }
}

/**
 * Update browser tab title with notification
 */
export function notifyInTab(message: string = '✅ Updated') {
  // Store original title on first call
  if (originalTitle === null) {
    originalTitle = document.title;
  }
  
  // Clear any existing flash interval
  if (titleFlashInterval !== null) {
    clearInterval(titleFlashInterval);
    titleFlashInterval = null;
  }
  
  // Update title immediately
  document.title = `${message} - SpecWright`;
  
  // Flash between notification and original title
  let isShowingNotification = true;
  titleFlashInterval = window.setInterval(() => {
    if (isShowingNotification) {
      document.title = originalTitle || 'SpecWright';
    } else {
      document.title = `${message} - SpecWright`;
    }
    isShowingNotification = !isShowingNotification;
  }, 1500);
}

/**
 * Clear tab notification and restore original title
 */
export function clearTabNotification() {
  if (titleFlashInterval !== null) {
    clearInterval(titleFlashInterval);
    titleFlashInterval = null;
  }
  
  if (originalTitle !== null) {
    document.title = originalTitle;
  }
}

/**
 * Reset title tracking (call when navigating to new page)
 */
export function resetTitleTracking() {
  clearTabNotification();
  originalTitle = null;
}

