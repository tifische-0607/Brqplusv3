import { Component, type ErrorInfo, type ReactNode } from "react";
import { AccessDenied } from "@/components/access-denied";
import { isForbiddenError } from "@/lib/authz-error";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches unexpected render-time errors inside admin pages and shows a
 * full access-denied state, ensuring no partial data leaks through.
 * Route-level loader errors are handled separately by `errorComponent`.
 */
export class AdminErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface for debugging; do not render error details to users.
    console.error("[AdminErrorBoundary]", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (isForbiddenError(error)) {
      return (
        <AccessDenied
          title="Admin role required"
          message="Your account does not have the admin privileges required to view this page."
        />
      );
    }

    return (
      <AccessDenied
        title="Something went wrong"
        message="An unexpected error occurred. For your safety, no admin data is shown. Please refresh and try again."
      />
    );
  }
}
