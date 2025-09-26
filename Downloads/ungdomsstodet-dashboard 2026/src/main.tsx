import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import SimpleAuth from "./components/SimpleAuth";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SimpleAuth />
  </StrictMode>
);
