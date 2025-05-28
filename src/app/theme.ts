import { createTheme } from "@mui/material/styles";
import "@fontsource/ubuntu";
import "@fontsource/cabin";
import "@fontsource/raleway";

const darkTheme = createTheme({
  palette: {
    mode: "dark", // Enables dark mode
    primary: {
      main: "#96ff9b", // Customize primary color
    },
    secondary: {
      main: "#dc004e", // Customize secondary color
    },
    background: {
      default: "#121212", // Dark background
      paper: "#1d1d1d",   // Card or container background
    },
    text: {
      primary: "#ffffff", // White text
      secondary: "#bdbdbd", // Dimmed text
    },
  },
  typography: {
    fontFamily: "'Ubuntu', 'Cabin', 'Raleway', 'Arial', sans-serif",
    h1: {
      fontFamily: "'Raleway', serif",
      fontWeight: 700,
    },
    h2: {
      fontFamily: "'Raleway', serif",
      fontWeight: 600,
    },
    body1: {
      fontFamily: "'Cabin', sans-serif",
    },
    body2: {
      fontFamily: "'Ubuntu', sans-serif",
    },
    button: {
      fontFamily: "'Ubuntu', sans-serif",
      textTransform: "none",
    },
  },
});

export default darkTheme;