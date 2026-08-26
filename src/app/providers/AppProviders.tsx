import { CssBaseline, ThemeProvider } from "@mui/material";
import { ReactNode } from "react";
import { theme } from "../../theme/theme";

type AppProvidersProps = { children: ReactNode };

export function AppProviders({ children }: AppProvidersProps) {
  return <ThemeProvider theme={theme}><CssBaseline />{children}</ThemeProvider>;
}
