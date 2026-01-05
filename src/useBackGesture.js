import { useEffect, useRef } from 'react';

/**
 * Intercepts the Android Back Gesture/Browser Back Button.
 * 
 * This hook pushes a "fake" entry to the browser's history stack when active,
 * allowing custom logic (like closing a modal) to run instead of navigating away.
 *
 * @param {boolean} active - Only listen when this specific modal/view is open
 * @param {Function} onBack - Function to run when back is pressed (e.g., closeModal)
 */
export const useBackGesture = (active, onBack) => {
    const onBackRef = useRef(onBack);
    const hasAddedHistoryEntry = useRef(false);

    // Keep callback ref updated
    useEffect(() => {
        onBackRef.current = onBack;
    }, [onBack]);

    useEffect(() => {
        if (!active) {
            hasAddedHistoryEntry.current = false;
            return;
        }

        // 1. Push a "fake" state to the history stack
        // Only push if we haven't already (prevents duplicate entries)
        if (!hasAddedHistoryEntry.current) {
            window.history.pushState({ modalOpen: true }, '');
            hasAddedHistoryEntry.current = true;
        }

        // 2. Define what happens when the user hits "Back"
        const handlePopState = () => {
            // Call the close handler
            onBackRef.current();
            hasAddedHistoryEntry.current = false;
        };

        // 3. Listen for the back gesture
        window.addEventListener('popstate', handlePopState);

        return () => {
            // Cleanup: Just remove the listener
            // We intentionally do NOT call history.back() here because:
            // 1. It causes race conditions with other active hooks
            // 2. The extra history entry is harmless - user just presses back again
            window.removeEventListener('popstate', handlePopState);
        };
    }, [active]);
};

