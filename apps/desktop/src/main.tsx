import { createRoot } from "react-dom/client";
import App from "./App";
import "@stellarUI/styles/globals.css";

// Tag the root element for platform-specific CSS (e.g., rounded corners on macOS)
if (navigator.platform.startsWith("Mac")) {
  document.documentElement.classList.add("macos");
}

createRoot(document.getElementById("root")!).render(<App />);
