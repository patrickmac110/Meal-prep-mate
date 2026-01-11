import { useEffect, useRef } from 'react';

/**
 * Global stack to track active back gesture handlers.
 * Only the TOP handler in the stack will fire on popstate.
 * This prevents multiple handlers from firing simultaneously.
 */
const handlerStack = [];
let globalListenerAttached = false;

const handleGlobalPopState = () => {
    // Only the topmost (most recently added) handler fires
    if (handlerStack.length > 0) {
        const topHandler = handlerStack[handlerStack.length - 1];
        if (topHandler && topHandler.callback) {
            topHandler.callback();
        }
    }
};

/**
 * Intercepts the Android Back Gesture/Browser Back Button.
 * 
 * Uses a global stack to ensure only ONE handler fires per back press.
 * The most recently activated handler (topmost in stack) gets priority.
 *
 * @param {boolean} active - Only listen when this specific modal/view is open
 * @param {Function} onBack - Function to run when back is pressed (e.g., closeModal)
 */
export const useBackGesture = (active, onBack) => {
    const onBackRef = useRef(onBack);
    const handlerIdRef = useRef(null);
    const hasAddedHistoryEntry = useRef(false);

    // Keep callback ref updated
    useEffect(() => {
        onBackRef.current = onBack;
        // Update callback in stack if we're already registered
        if (handlerIdRef.current) {
            const handler = handlerStack.find(h => h.id === handlerIdRef.current);
            if (handler) {
                handler.callback = onBack;
            }
        }
    }, [onBack]);

    useEffect(() => {
        if (!active) {
            // Remove from stack if we were active
            if (handlerIdRef.current) {
                const index = handlerStack.findIndex(h => h.id === handlerIdRef.current);
                if (index !== -1) {
                    handlerStack.splice(index, 1);
                }
                handlerIdRef.current = null;
            }
            hasAddedHistoryEntry.current = false;
            return;
        }

        // Generate unique ID for this handler instance
        const handlerId = Date.now() + Math.random();
        handlerIdRef.current = handlerId;

        // Add to stack
        handlerStack.push({
            id: handlerId,
            callback: onBackRef.current
        });

        // Push history entry only once per activation
        if (!hasAddedHistoryEntry.current) {
            window.history.pushState({ modalOpen: true, handlerId }, '');
            hasAddedHistoryEntry.current = true;
        }

        // Attach global listener only once
        if (!globalListenerAttached) {
            window.addEventListener('popstate', handleGlobalPopState);
            globalListenerAttached = true;
        }

        return () => {
            // Remove from stack on cleanup
            const index = handlerStack.findIndex(h => h.id === handlerId);
            if (index !== -1) {
                handlerStack.splice(index, 1);
            }
            handlerIdRef.current = null;

            // Remove global listener only if stack is empty
            if (handlerStack.length === 0 && globalListenerAttached) {
                window.removeEventListener('popstate', handleGlobalPopState);
                globalListenerAttached = false;
            }
        };
    }, [active]);
};
