import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthProvider';
import { supabase } from '../lib/supabase';

interface SessionTrackerOptions {
  heartbeatInterval?: number; // Interval in milliseconds (default: 120000 = 2 minutes)
  activityThreshold?: number; // Seconds of inactivity before pausing (default: 10 minutes = 600 seconds)
  debounceInterval?: number; // Debounce activity detection (default: 5000 = 5 seconds)
  /** Inactivity logout: after this many ms with no user activity, sign out. Default 2 hours. Set 0 to disable. */
  inactivityLogoutMs?: number;
}

/**
 * Hook to track user session activity
 * - Tracks active time only when page is visible and user is interacting
 * - Sends heartbeat every 2 minutes
 * - Handles tab visibility changes
 * - Tracks single tab (if multiple tabs, only one is tracked)
 */
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export const useSessionTracker = (options: SessionTrackerOptions = {}) => {
  const { session, profile, signOut } = useAuth();
  const {
    heartbeatInterval = 120000, // 2 minutes
    activityThreshold = 600, // 10 minutes
    debounceInterval = 5000, // 5 seconds
    inactivityLogoutMs = TWO_HOURS_MS, // 2 hours; set 0 to disable
  } = options;

  // Refs to track state
  const isTrackingRef = useRef(false);
  const isPageVisibleRef = useRef(true);
  const lastActivityTimeRef = useRef<number>(Date.now());
  const accumulatedSecondsRef = useRef<number>(0);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionTokenRef = useRef<string | null>(null);

  // Get API base URL
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.maduratravel.com';

  // Generate unique session token for this tab
  useEffect(() => {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      localStorage.setItem('crm_session_token', sessionTokenRef.current);
    }
  }, []);

  // Check if this tab should be the active tracker (single tab tracking)
  // Simple approach: Use localStorage to coordinate tabs
  const checkTabLock = useCallback((): boolean => {
    const currentToken = sessionTokenRef.current;
    if (!currentToken) return false;

    // Check if another tab has claimed the lock recently (within last 5 seconds)
    const lastActiveToken = localStorage.getItem('crm_active_tab_token');
    const lastActiveTime = localStorage.getItem('crm_active_tab_time');
    
    if (lastActiveToken && lastActiveTime) {
      const timeSinceLastActive = Date.now() - parseInt(lastActiveTime);
      // If another tab was active within last 5 seconds and it's not this tab, don't track
      if (timeSinceLastActive < 5000 && lastActiveToken !== currentToken) {
        return false;
      }
    }

    // Claim the lock for this tab
    localStorage.setItem('crm_active_tab_token', currentToken);
    localStorage.setItem('crm_active_tab_time', Date.now().toString());
    return true;
  }, []);

  // Send heartbeat to server
  const sendHeartbeat = useCallback(async () => {
    if (!session?.access_token || !profile) return;

    const isActive = checkTabLock();
    if (!isActive) {
      // Another tab is active, don't send heartbeat
      return;
    }

    const activeSeconds = accumulatedSecondsRef.current;
    accumulatedSecondsRef.current = 0; // Reset accumulator

    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${API_BASE}/api/sessions/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          activeSeconds,
          isPageVisible: isPageVisibleRef.current,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        // Re-accumulate if failed (will retry next heartbeat)
        accumulatedSecondsRef.current += activeSeconds;
        if (import.meta.env.DEV) {
          const error = await response.json().catch(() => ({ message: 'Unknown error' }));
          console.debug('[SessionTracker] Heartbeat failed (non-critical):', error.message);
        }
      }
    } catch (error: any) {
      // Re-accumulate if failed
      accumulatedSecondsRef.current += activeSeconds;
      // Only log in dev mode - CORS/network errors are expected if API is down
      if (import.meta.env.DEV && !error.message?.includes('aborted')) {
        console.debug('[SessionTracker] Heartbeat error (non-critical):', error.message);
      }
    }
  }, [session?.access_token, profile, API_BASE, checkTabLock]);

  // Update tab lock periodically
  useEffect(() => {
    if (!session || !profile) return;

    const updateTabLock = () => {
      if (isPageVisibleRef.current && isTrackingRef.current) {
        const currentToken = sessionTokenRef.current;
        if (currentToken) {
          localStorage.setItem('crm_active_tab_token', currentToken);
          localStorage.setItem('crm_active_tab_time', Date.now().toString());
        }
      }
    };

    const interval = setInterval(updateTabLock, 3000); // Update every 3 seconds
    return () => clearInterval(interval);
  }, [session, profile]);

  // Track activity (debounced)
  const trackActivity = useCallback(() => {
    if (!isPageVisibleRef.current) return;

    // Debounce activity detection
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      lastActivityTimeRef.current = Date.now();
      
      // If we were idle, resume tracking
      if (!isTrackingRef.current && isPageVisibleRef.current) {
        isTrackingRef.current = true;
      }
    }, debounceInterval);
  }, [debounceInterval]);

  // Start/stop tracking based on activity
  useEffect(() => {
    if (!session || !profile) return;

    const checkActivity = () => {
      const now = Date.now();
      const timeSinceLastActivity = (now - lastActivityTimeRef.current) / 1000; // seconds

      if (isPageVisibleRef.current && timeSinceLastActivity < activityThreshold) {
        // User is active
        if (!isTrackingRef.current) {
          isTrackingRef.current = true;
        }
      } else {
        // User is idle or page hidden
        if (isTrackingRef.current) {
          isTrackingRef.current = false;
        }
      }
    };

    // Check activity every 30 seconds
    activityTimerRef.current = setInterval(checkActivity, 30000);

    return () => {
      if (activityTimerRef.current) {
        clearInterval(activityTimerRef.current);
      }
    };
  }, [session, profile, activityThreshold]);

  // Accumulate active time
  useEffect(() => {
    if (!session || !profile) return;

    const interval = setInterval(() => {
      if (isTrackingRef.current && isPageVisibleRef.current) {
        // Add 30 seconds of active time
        accumulatedSecondsRef.current += 30;
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [session, profile]);

  // Send heartbeat periodically
  useEffect(() => {
    if (!session || !profile) return;

    heartbeatTimerRef.current = setInterval(() => {
      sendHeartbeat();
    }, heartbeatInterval);

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
    };
  }, [session, profile, heartbeatInterval, sendHeartbeat]);

  // Track page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden;
      
      if (document.hidden) {
        // Page hidden - pause tracking and send final heartbeat
        if (isTrackingRef.current) {
          isTrackingRef.current = false;
          sendHeartbeat(); // Send accumulated time before pausing
        }
      } else {
        // Page visible - resume tracking
        lastActivityTimeRef.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [sendHeartbeat]);

  // Inactivity logout: after inactivityLogoutMs with no activity, sign out (e.g. 2 hours)
  useEffect(() => {
    if (!session || !profile || inactivityLogoutMs <= 0 || !signOut) return;

    const checkInactivityLogout = () => {
      const elapsed = Date.now() - lastActivityTimeRef.current;
      if (elapsed >= inactivityLogoutMs) {
        signOut();
      }
    };

    const interval = setInterval(checkInactivityLogout, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [session, profile, signOut, inactivityLogoutMs]);

  // Track user interactions
  useEffect(() => {
    if (!session || !profile) return;

    // Track various user interactions
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      window.addEventListener(event, trackActivity, { passive: true });
    });

    // Initial activity
    trackActivity();

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, trackActivity);
      });
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [session, profile, trackActivity]);

  // Handle browser close (best effort)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Send final heartbeat if possible (may not always work)
      if (navigator.sendBeacon && session?.access_token) {
        const activeSeconds = accumulatedSecondsRef.current;
        const blob = new Blob(
          [JSON.stringify({ activeSeconds, isPageVisible: false })],
          { type: 'application/json' }
        );
        navigator.sendBeacon(
          `${API_BASE}/api/sessions/heartbeat`,
          blob
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [session?.access_token, API_BASE]);

};
