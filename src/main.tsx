import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import PortalApp from "./portal/PortalApp.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import { isPortalHost } from "./lib/domainResolver";
import "./index.css";
import "./i18n";

// The portal renders on the reserved `portal.` host (production) OR under the
// /portal path (works on any host — used for local dev and as a universal fallback).
const isPortalPath = window.location.pathname === "/portal" || window.location.pathname.startsWith("/portal/");
const Root = isPortalHost() || isPortalPath ? PortalApp : App;

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <Root />
  </ErrorBoundary>,
);

if (!isPortalHost() && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
