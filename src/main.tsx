import React from "react";
import ReactDOM from "react-dom/client";
import { DiscoverApp } from "./ui/discover/DiscoverApp";
import "./ui/studio.css";
import "./ui/discover/discover.css";

// The primary journey is the backend-connected discovery app (real public proteins,
// streamed runs, candidate-specific physics). The legacy in-browser pipeline
// (src/ui/App.tsx) is retained only as an offline smoke fixture behind the vitest
// suite; it no longer powers the shipped UI.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DiscoverApp />
  </React.StrictMode>,
);
