import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import SimpleAuth from "./components/SimpleAuth";
import "./index.css"; // PRINT NEW: Import CSS för print-stilar

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SimpleAuth />
  </StrictMode>
);
