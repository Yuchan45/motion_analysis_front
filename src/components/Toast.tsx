import { useEffect, useRef } from "react";

export type ToastType = "info" | "warning" | "success" | "error";

export type ToastAction = {
  label: string;
  onClick: () => void;
  tone?: "primary" | "secondary";
};

type ToastProps = {
  type?: ToastType;
  message?: string;
  autoCloseMs?: number | null;
  onClose: () => void;
  actions?: ToastAction[];
};

const DEFAULT_MESSAGES: Record<ToastType, string> = {
  info: "Hay nueva informacion disponible.",
  warning: "Revisa esta accion antes de continuar.",
  success: "La operacion se completo correctamente.",
  error: "No se pudo completar la operacion.",
};

export function Toast({
  type = "info",
  message,
  autoCloseMs = null,
  onClose,
  actions = [],
}: ToastProps) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!autoCloseMs) return undefined;
    const timeout = window.setTimeout(() => onCloseRef.current(), autoCloseMs);
    return () => window.clearTimeout(timeout);
  }, [autoCloseMs]);

  return (
    <section className={`toast toast--${type}`} role={type === "error" ? "alert" : "status"} aria-live="polite">
      <div className="toast-content">
        <span className="toast-type">{type}</span>
        <p>{message ?? DEFAULT_MESSAGES[type]}</p>
      </div>
      <button className="toast-close" type="button" onClick={onClose} aria-label="Cerrar alerta">&#215;</button>
      {actions.length > 0 && (
        <div className="toast-actions">
          {actions.map((action) => (
            <button
              key={action.label}
              className={`toast-action ${action.tone === "secondary" ? "is-secondary" : ""}`}
              type="button"
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
      {autoCloseMs && (
        <span className="toast-timer" aria-hidden="true">
          <span style={{ animationDuration: `${autoCloseMs}ms` }} />
        </span>
      )}
    </section>
  );
}
