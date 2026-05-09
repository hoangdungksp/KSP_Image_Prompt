/**
 * Editor tab entry point — mounts the full-width 1400px Editor.
 * Opened via window.open() from sidebar (Hybrid Q1 = C).
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { EditorTab } from "./components/EditorTab";
import "./styles/index.css";
import "./components/v0_9_0.css";
import "./components/v0_9_0_phase2.css";
import "./components/v0_9_0_phase34.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <EditorTab />
  </React.StrictMode>
);
