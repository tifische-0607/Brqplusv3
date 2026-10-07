import { Component, useEffect, useState, type ReactNode } from "react";
import { reportLovableError } from "../lib/lovable-error-reporting";

type CapturedError = {
  message: string;
  stack?: string;
  source: "render" | "window" | "promise";
};

function ErrorOverlay({ error, onDismiss }: { error: CapturedError; onDismiss: () => void }) {
  const stackHref = error.stack
    ? `data:text/plain;charset=utf-8,${encodeURIComponent(error.stack)}`
    : undefined;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 bottom-0 z-[9999] mx-auto max-w-2xl rounded-t-xl border border-destructive/40 bg-background/95 p-4 shadow-2xl backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-destructive">
            Runtime error ({error.source})
          </p>
          <p className="mt-1 truncate font-mono text-sm text-foreground" title={error.message}>
            {error.message}
          </p>
          {error.stack ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Show stack trace
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted/50 p-2 text-[11px] leading-snug text-muted-foreground">
                {error.stack}
              </pre>
              {stackHref ? (
                <a
                  href={stackHref}
                  download="stack-trace.txt"
                  className="mt-2 inline-block text-xs text-cyan underline hover:brightness-110"
                >
                  Download stack trace
                </a>
              ) : null}
            </details>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110"
          >
            Reload
          </button>
          <button
            onClick={onDismiss}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export function GlobalErrorListener() {
  const [error, setError] = useState<CapturedError | null>(null);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const err = event.error instanceof Error ? event.error : new Error(event.message);
      reportLovableError(err, { boundary: "window_onerror" });
      setError({ message: err.message, stack: err.stack, source: "window" });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const err = reason instanceof Error ? reason : new Error(String(reason));
      reportLovableError(err, { boundary: "unhandled_rejection" });
      setError({ message: err.message, stack: err.stack, source: "promise" });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  if (!error) return null;
  return <ErrorOverlay error={error} onDismiss={() => setError(null)} />;
}

type BoundaryProps = { children: ReactNode };
type BoundaryState = { error: Error | null };

export class GlobalErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error(error);
    reportLovableError(error, {
      boundary: "global_error_boundary",
      componentStack: info.componentStack,
    });
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const stackHref = error.stack
      ? `data:text/plain;charset=utf-8,${encodeURIComponent(error.stack)}`
      : undefined;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-wider text-destructive">
            Application error
          </p>
          <h1 className="mt-1 font-display text-xl font-semibold text-foreground">
            Something broke while rendering
          </h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">{error.message}</p>
          {error.stack ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Show stack trace
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted/50 p-2 text-[11px] leading-snug text-muted-foreground">
                {error.stack}
              </pre>
              {stackHref ? (
                <a
                  href={stackHref}
                  download="stack-trace.txt"
                  className="mt-2 inline-block text-xs text-cyan underline hover:brightness-110"
                >
                  Download stack trace
                </a>
              ) : null}
            </details>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={() => {
                this.reset();
                window.location.reload();
              }}
              className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
            >
              Reload app
            </button>
            <a
              href="/"
              className="rounded-md border border-cyan/60 px-4 py-2 text-sm font-semibold text-cyan hover:bg-cyan/10"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
