// ABOUTME: Renders the shared backdrop, dialog frame, heading, close control, and swipe dismissal.
// ABOUTME: Keeps mobile sheet mechanics identical for logging and library filtering.
import type { ReactNode, TouchEvent } from 'react';
import { shouldDismissSheet } from '../sheet-gesture.js';

interface SheetDialogProps {
  backdropClassName: string;
  children?: ReactNode;
  eyebrow: string;
  headClassName: string;
  label: string;
  onClose(): void;
  sheetClassName: string;
  title: string;
}

export function SheetDialog({
  backdropClassName,
  children,
  eyebrow,
  headClassName,
  label,
  onClose,
  sheetClassName,
  title
}: SheetDialogProps) {
  function recordSheetTouch(event: TouchEvent<HTMLElement>): void {
    const startY = event.changedTouches[0]?.clientY;

    if (startY !== undefined) {
      event.currentTarget.dataset.sheetTouchStartY = String(startY);
    }
  }

  function closeFromSheetTouch(event: TouchEvent<HTMLElement>): void {
    const endY = event.changedTouches[0]?.clientY;
    const startY = Number(event.currentTarget.dataset.sheetTouchStartY);

    if (Number.isFinite(startY) && endY !== undefined && shouldDismissSheet(startY, endY)) {
      onClose();
    }

    delete event.currentTarget.dataset.sheetTouchStartY;
  }

  return (
    <div className={backdropClassName} onClick={onClose} role="presentation">
      <section
        aria-label={label}
        aria-modal="true"
        className={sheetClassName}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header
          className={headClassName}
          onTouchCancel={(event) => { delete event.currentTarget.dataset.sheetTouchStartY; }}
          onTouchEnd={closeFromSheetTouch}
          onTouchStart={recordSheetTouch}
        >
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
          <button aria-label={`Close ${label.toLowerCase()}`} className="sheet-close" onClick={onClose} type="button">
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
