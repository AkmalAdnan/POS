import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register PWA service worker (production only)
if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => {
        // Try to flush any queued offline writes when we come back online
        const flush = () => navigator.serviceWorker.controller?.postMessage("FLUSH");
        window.addEventListener("online", flush);
        if (navigator.onLine) flush();
        // also try background sync API
        if ("sync" in reg) reg.sync.register("spice-flush").catch(() => {});
      })
      .catch(() => {});
  });
}
