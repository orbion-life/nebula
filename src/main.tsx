import React from "react";
import ReactDOM from "react-dom/client";
import { DiscoverApp } from "./ui/discover/DiscoverApp";
import "./ui/discover/discover.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DiscoverApp />
  </React.StrictMode>,
);
