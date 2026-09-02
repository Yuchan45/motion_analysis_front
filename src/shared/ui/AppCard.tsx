import { Paper, PaperProps } from "@mui/material";

export function AppCard({ children, sx, ...props }: PaperProps) {
  return <Paper elevation={0} sx={{ borderRadius: 3, ...sx }} {...props}>{children}</Paper>;
}
