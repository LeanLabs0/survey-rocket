import { useEffect, useRef, useState } from "react";

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = true,
  onCancel,
  onConfirm,
}: ConfirmOptions & {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="overlay open" role="presentation" onClick={onCancel}>
      <div
        className="modal modal-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sr-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="sr-confirm-title">{title}</h3>
        <p className="sub">{message}</p>
        <div className="modal-foot">
          <button ref={cancelRef} className="btn ghost" type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={danger ? "btn danger" : "btn primary"} type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);

  function confirm(opts: ConfirmOptions) {
    return new Promise<boolean>((resolve) => setPending({ ...opts, resolve }));
  }

  function close(ok: boolean) {
    pending?.resolve(ok);
    setPending(null);
  }

  const dialog = (
    <ConfirmDialog
      open={!!pending}
      title={pending?.title || ""}
      message={pending?.message || ""}
      confirmLabel={pending?.confirmLabel}
      cancelLabel={pending?.cancelLabel}
      danger={pending?.danger}
      onCancel={() => close(false)}
      onConfirm={() => close(true)}
    />
  );

  return { confirm, dialog };
}
