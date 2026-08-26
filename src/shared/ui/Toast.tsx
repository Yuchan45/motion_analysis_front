import { Alert, AlertColor, Button, LinearProgress, Snackbar, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";

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
  const [remaining, setRemaining] = useState(100);

  useEffect(() => {
    if (!autoCloseMs) return undefined;
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setRemaining(Math.max(0, 100 - (Date.now() - startedAt) / autoCloseMs * 100));
    }, 50);
    return () => window.clearInterval(interval);
  }, [autoCloseMs]);

  return (
    <Snackbar
      open
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      autoHideDuration={autoCloseMs ?? undefined}
      onClose={(_, reason) => { if (reason !== "clickaway") onClose(); }}
    >
      <Alert severity={type as AlertColor} variant="filled" onClose={onClose} sx={{ minWidth: 320 }}>
        <Typography variant="body2">{message ?? DEFAULT_MESSAGES[type]}</Typography>
        {actions.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            {actions.map((action) => (
              <Button
                key={action.label}
                color={action.tone === "secondary" ? "inherit" : "secondary"}
                size="small"
                variant={action.tone === "secondary" ? "outlined" : "contained"}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </Stack>
        )}
        {autoCloseMs && <LinearProgress color="inherit" variant="determinate" value={remaining} sx={{ mt: 1 }} />}
      </Alert>
    </Snackbar>
  );
}
