/**
 * Editor tab entry point — mounts the Editor in a separate tab/window.
 * v0.9.3-r1: legacy EditorTab full-width removed (dead feature), uses Editor sidebar instead.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { Editor } from "./components/Editor";
import "./styles/index.css";
import "./components/base.css";
import "./components/photos.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Editor />
  </React.StrictMode>
);
