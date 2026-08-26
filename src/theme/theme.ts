import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: { main: "#ef4c26" },
    secondary: { main: "#c8f45b" },
    background: { default: "#f0eee5", paper: "#f0eee5" },
    text: { primary: "#142226" },
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: '"Bahnschrift", "DIN Alternate", sans-serif',
    button: { fontWeight: 700, textTransform: "none" },
  },
  components: {
    MuiButton: { styleOverrides: { root: { borderRadius: 0 } } },
  },
});
