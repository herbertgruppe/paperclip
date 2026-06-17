import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

function reportClientError(error: Error, info: ErrorInfo) {
  try {
    fetch("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: String(error.message).slice(0, 2000),
        stack: String(error.stack ?? "").slice(0, 10000),
        componentStack: String(info.componentStack ?? "").slice(0, 10000),
        url: window.location.pathname,
        userAgent: navigator.userAgent.slice(0, 500),
      }),
      keepalive: true,
    }).catch(() => {
      // best-effort; swallow network failures
    });
  } catch {
    // never let the reporter crash the boundary itself
  }
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportClientError(error, info);
  }

  override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md text-center">
          <div className="mb-4 text-4xl" role="img" aria-label="Error">
            &#x26A0;&#xFE0F;
          </div>
          <h1 className="mb-2 text-xl font-semibold text-foreground">Something went wrong</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            An unexpected error occurred. The team has been notified. Try reloading the page.
          </p>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
