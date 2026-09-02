// @ts-nocheck
import { Button, ButtonProps } from "@mui/material";

export function AppButton({ children, variant = "contained", ...props }: ButtonProps) {
  return <Button disableElevation variant={variant} {...props}>{children}</Button>;
}
