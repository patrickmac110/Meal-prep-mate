import { useEffect } from 'react';

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
    useEffect(() => {
        if (!active) return;

        // 1. Push a "fake" state to the history stack
        // This makes the browser think we went to a new page, so "Back" has somewhere to go.
        window.history.pushState({ modalOpen: true }, '');

        // 2. Define what happens when the user hits "Back"
        const handlePopState = (event) => {
            // Prevent the default browser action if needed (though usually popstate is enough)
            onBack();
        };

        // 3. Listen for the back gesture
        window.addEventListener('popstate', handlePopState);

        return () => {
            // Cleanup: Remove listener
            window.removeEventListener('popstate', handlePopState);

            // IMPORTANT: If the component unmounts naturally (e.g. user clicked "X" button),
            // we must remove the "fake" history item we added, otherwise the user 
            // has to hit back twice later.
            if (window.history.state?.modalOpen) {
                window.history.back();
            }
        };
    }, [active]); // Re-run only when 'active' status changes
};
