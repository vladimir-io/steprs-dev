"use client";

interface FileToastProps {
  message: string;
  onDismiss: () => void;
}

/** Boundary validation and parse errors — fixed, dismissible. */
export function FileToast({ message, onDismiss }: FileToastProps) {
  return (
    <div className="file-toast" role="alert" aria-live="assertive">
      <div className="file-toast__panel">
        <p className="file-toast__title">Could not open file</p>
        <p className="file-toast__body">{message}</p>
        <button type="button" className="file-toast__dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
