import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { Home } from "./Home";

const rootElement = document.getElementById("app");

if (!rootElement) {
  throw new Error("Missing #app element in index.html");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Home />
  </React.StrictMode>,
);
