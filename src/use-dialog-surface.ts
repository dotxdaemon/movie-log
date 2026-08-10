// ABOUTME: Applies initial focus, focus trapping, Escape dismissal, and opener restoration to renderer sheets.
// ABOUTME: Shares one accessible dialog lifecycle between sheets and destructive confirmation.
import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { readDialogFocusTarget } from './dialog-focus.js';

interface DialogSurfaceOptions {
  confirmationOpen: boolean;
  filterSheetOpen: boolean;
  logPanelOpen: boolean;
  setConfirmationOpen(open: boolean): void;
  setFilterSheetOpen: Dispatch<SetStateAction<boolean>>;
  setLogPanelOpen: Dispatch<SetStateAction<boolean>>;
}

export function useDialogSurface(options: DialogSurfaceOptions): () => void {
  const { confirmationOpen, filterSheetOpen, logPanelOpen, setConfirmationOpen, setFilterSheetOpen, setLogPanelOpen } =
    options;
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!logPanelOpen && !filterSheetOpen && !confirmationOpen) {
      return;
    }

    const selector = confirmationOpen ? '.confirmation-dialog' : logPanelOpen ? '.log-sheet' : '.filter-sheet';
    const readDialog = () => document.querySelector<HTMLElement>(selector);
    const readFocusable = () =>
      [...(readDialog()?.querySelectorAll<HTMLElement>('button, input, select, textarea, summary') ?? [])].filter(
        (element) => !element.hasAttribute('disabled')
      );
    const initialTarget = readDialog()?.querySelector<HTMLElement>('input, textarea, select') ?? readFocusable()[0];
    initialTarget?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (confirmationOpen) {
          setConfirmationOpen(false);
        } else {
          (logPanelOpen ? setLogPanelOpen : setFilterSheetOpen)(false);
        }
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const target = readDialogFocusTarget(readFocusable(), document.activeElement, event.shiftKey);

      if (target) {
        event.preventDefault();
        target.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.setTimeout(() => {
        if (!document.querySelector('.log-sheet, .filter-sheet, .confirmation-dialog')) {
          returnFocus.current?.focus();
          returnFocus.current = null;
        }
      }, 0);
    };
  }, [confirmationOpen, filterSheetOpen, logPanelOpen, setConfirmationOpen, setFilterSheetOpen, setLogPanelOpen]);

  return () => {
    const activeElement = document.activeElement as HTMLElement | null;

    if (activeElement && !activeElement.closest('.log-sheet, .filter-sheet, .confirmation-dialog')) {
      returnFocus.current = activeElement;
    }
  };
}
