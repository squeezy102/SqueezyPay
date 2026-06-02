import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";

const API_BASE = `http://${window.location.hostname}:8000`;

function reportError(error: Error, componentStack: string) {
  fetch(`${API_BASE}/api/frontend-log/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      level: "ERROR",
      message: error.message,
      detail: error.stack ?? "",
      component: componentStack,
    }),
  }).catch(() => {
    console.error("[ErrorBoundary] Failed to report error to backend:", error);
  });
}

interface Props {
  children: ReactNode;
}

interface State {
  crashed: boolean;
  message: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { crashed: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { crashed: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, info.componentStack ?? "");
  }

  render() {
    if (!this.state.crashed) return this.props.children;

    return (
      <div style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f1f5f9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "24px",
      }}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 16 }}>⚠</div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "0.875rem", marginBottom: 24 }}>
            The app crashed unexpectedly. The error has been logged.
          </p>
          <code style={{
            display: "block",
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: "0.75rem",
            color: "#ef4444",
            textAlign: "left",
            wordBreak: "break-word",
            marginBottom: 24,
          }}>
            {this.state.message}
          </code>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#6366f1",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 24px",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
