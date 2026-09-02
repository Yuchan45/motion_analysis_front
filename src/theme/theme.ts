import { alpha, createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#d8ff3f", dark: "#9ec11a", light: "#eeff9a", contrastText: "#07151d" },
    secondary: { main: "#ff6946", dark: "#c74529", light: "#ff9a82", contrastText: "#ffffff" },
    background: { default: "#07151d", paper: "#102730" },
    text: { primary: "#f5f7f3", secondary: "#a6bac3" },
    divider: "rgba(216, 255, 63, 0.16)",
    success: { main: "#6ce6a7" },
    warning: { main: "#ffd166" },
    error: { main: "#ff7d75" },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
    h1: { fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif', fontWeight: 800, letterSpacing: "-0.035em", textTransform: "uppercase" },
    h2: { fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif', fontWeight: 700, letterSpacing: "-0.02em", textTransform: "uppercase" },
    h5: { fontFamily: '"Barlow Condensed", "Arial Narrow", sans-serif', fontWeight: 700, letterSpacing: "0.01em", textTransform: "uppercase" },
    button: { fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.045em", fontSize: "0.74rem" },
  },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { backgroundColor: "#07151d" } } },
    MuiButton: { styleOverrides: { root: { borderRadius: 6, minHeight: 42, paddingInline: 18 } } },
    MuiPaper: { styleOverrides: { root: { border: "1px solid rgba(216, 255, 63, 0.16)", boxShadow: "0 16px 34px rgba(0, 0, 0, 0.26)" } } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 6, backgroundColor: "rgba(0, 0, 0, 0.18)" } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 4, fontWeight: 800 } } },
  },
});

export const surfaceTint = alpha(theme.palette.primary.main, 0.08);
