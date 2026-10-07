import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles.css";
import { ensureHashRoute, installHashRouteLinkGuard } from "./lib/appLocation.js";

const redirectedToHashRoute = ensureHashRoute();

if (!redirectedToHashRoute) {
  installHashRouteLinkGuard();
  createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>,
  );
}
