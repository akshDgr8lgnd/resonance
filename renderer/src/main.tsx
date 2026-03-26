import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { App } from "./App";
import "./styles.css";

const queryClient = new QueryClient();
const isPackagedRenderer = window.location.protocol === "file:";

class RendererBoundary extends React.Component<
  React.PropsWithChildren,
  { hasError: boolean; message: string }
> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown renderer error";
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown) {
    console.error("Renderer crashed", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#121212", color: "#f5f5f5", fontFamily: "Figtree, sans-serif", padding: 24 }}>
          <div style={{ maxWidth: 640, padding: 24, borderRadius: 20, background: "#181818", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h1 style={{ marginTop: 0 }}>Resonance hit a renderer error</h1>
            <p style={{ color: "#b3b3b3" }}>{this.state.message}</p>
            <p style={{ color: "#b3b3b3" }}>Please relaunch the app. If this persists, the desktop log will have the exact failure details.</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RendererBoundary>
        {isPackagedRenderer ? (
          <MemoryRouter initialEntries={["/"]}>
            <App />
          </MemoryRouter>
        ) : (
          <BrowserRouter>
            <App />
          </BrowserRouter>
        )}
      </RendererBoundary>
    </QueryClientProvider>
  </React.StrictMode>
);
