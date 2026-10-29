import { useCallback, KeyboardEvent } from 'react';

interface UseWindowKeyboardProps {
  onClose: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
}

export function useWindowKeyboard({ onClose, onMinimize, onMaximize }: UseWindowKeyboardProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      // Keyboard Shortcuts
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.ctrlKey && e.key === 'm') {
        e.preventDefault();
        if (onMinimize) onMinimize();
      }
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (onMaximize) onMaximize();
      }

      // Simple Focus Trap: Tab handling
      if (e.key === 'Tab') {
        const focusableElements = e.currentTarget.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length > 0) {
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

          if (e.shiftKey) {
            // Shift + Tab
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement.focus();
            }
          } else {
            // Tab
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }
        }
      }
    },
    [onClose, onMinimize, onMaximize]
  );

  return { handleKeyDown };
}
