import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import PortalApp from "./portal/PortalApp.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import { isPortalHost } from "./lib/domainResolver";
import "./index.css";
import "./i18n";

const Root = isPortalHost() ? PortalApp : App;

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
