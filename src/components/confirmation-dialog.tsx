// ABOUTME: Renders the focused confirmation surface used for irreversible journal actions.
// ABOUTME: Keeps destructive copy and actions explicit without borrowing the larger sheet layout.

interface ConfirmationDialogProps {
  busy: boolean;
  confirmLabel: string;
  description: string;
  onCancel(): void;
  onConfirm(): void;
  title: string;
}

export function ConfirmationDialog({
  busy,
  confirmLabel,
  description,
  onCancel,
  onConfirm,
  title
}: ConfirmationDialogProps) {
  return (
    <div className="confirmation-backdrop" onClick={busy ? undefined : onCancel} role="presentation">
      <section
        aria-describedby="confirmation-description"
        aria-labelledby="confirmation-title"
        aria-modal="true"
        className="confirmation-dialog"
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
      >
        <p className="eyebrow">Journal change</p>
        <h2 id="confirmation-title">{title}</h2>
        <p id="confirmation-description">{description}</p>
        <div className="confirmation-actions">
          <button className="command-block confirmation-cancel" disabled={busy} onClick={onCancel} type="button">
            Keep viewing
          </button>
          <button className="command-block confirmation-confirm" disabled={busy} onClick={onConfirm} type="button">
            {busy ? 'Deleting viewing…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
