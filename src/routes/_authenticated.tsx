import { createFileRoute, redirect, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { loading, userId, profile } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !userId) navigate({ to: "/login" });
  }, [loading, userId, navigate]);

  if (loading || !userId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (profile && profile.is_active === false) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <h2 className="font-display text-2xl text-accent">Account deactivated</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account has been deactivated by an administrator. Contact the league admin to be reinstated.
        </p>
      </div>
    );
  }
  return <Outlet />;
}
