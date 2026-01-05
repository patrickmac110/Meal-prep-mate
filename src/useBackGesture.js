import { useEffect, useRef } from 'react';

// Global flag to prevent cascading popstate handlers during cleanup
let isCleaningUp = false;

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

    // Keep callback ref updated
    useEffect(() => {
        onBackRef.current = onBack;
    }, [onBack]);

    useEffect(() => {
        if (!active) return;

        // 1. Push a "fake" state to the history stack with unique identifier
        const stateId = Date.now() + Math.random();
        window.history.pushState({ modalOpen: true, id: stateId }, '');

        // 2. Define what happens when the user hits "Back"
        const handlePopState = (event) => {
            // Ignore popstate events triggered by cleanup of other hooks
            if (isCleaningUp) return;

            onBackRef.current();
        };

        // 3. Listen for the back gesture
        window.addEventListener('popstate', handlePopState);

        return () => {
            // Cleanup: Remove listener FIRST to prevent this instance from catching its own back()
            window.removeEventListener('popstate', handlePopState);

            // Set global flag to prevent other active listeners from firing
            isCleaningUp = true;

            // IMPORTANT: If the component unmounts naturally (e.g. user clicked "X" button),
            // we must remove the "fake" history item we added, otherwise the user 
            // has to hit back twice later.
            if (window.history.state?.modalOpen) {
                window.history.back();
            }

            // Reset flag after a microtask to allow the popstate event to be ignored
            setTimeout(() => {
                isCleaningUp = false;
            }, 0);
        };
    }, [active]); // Re-run only when 'active' status changes
};
