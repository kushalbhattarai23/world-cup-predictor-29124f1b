import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Trophy, LogOut } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-8xl text-primary">404</h1>
        <p className="mt-2 text-muted-foreground">Off the pitch.</p>
        <Link to="/" className="mt-6 inline-block rounded-lg bg-primary px-5 py-2 text-primary-foreground font-semibold">
          Back to base
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h2 className="font-display text-3xl">Something went wrong</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-lg bg-primary px-5 py-2 text-primary-foreground font-semibold"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Pitch Predictor — World Cup 2026" },
      { name: "description", content: "Invite-only FIFA World Cup 2026 prediction league." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Header() {
  const { userId, profile, isAdmin, signOut } = useAuth();
  if (!userId) return null;
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/15 p-2">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <span className="font-display text-2xl tracking-wider">Pitch Predictor</span>
        </Link>
        <nav className="hidden gap-1 md:flex">
          {[
            { to: "/", label: "Dashboard" },
            { to: "/matches", label: "Matches" },
            { to: "/leaderboard", label: "Leaderboard" },
            { to: "/rooms", label: "Rooms" },
            { to: "/rules", label: "Rules" },
            ...(isAdmin ? [{ to: "/admin", label: "Admin" }] : []),
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              activeProps={{ className: "rounded-md px-3 py-1.5 text-sm font-medium bg-primary/15 text-primary" }}
              activeOptions={{ exact: l.to === "/" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {profile?.username ?? "Player"}
          </span>
          <button
            onClick={() => signOut()}
            className="rounded-md border border-border bg-card p-2 text-muted-foreground hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
        {[
          { to: "/", label: "Home" },
          { to: "/matches", label: "Matches" },
          { to: "/leaderboard", label: "Board" },
          { to: "/rooms", label: "Rooms" },
          { to: "/rules", label: "Rules" },
          ...(isAdmin ? [{ to: "/admin", label: "Admin" }] : []),
        ].map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            activeProps={{ className: "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium bg-primary/15 text-primary" }}
            activeOptions={{ exact: l.to === "/" }}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-6 md:py-10">
          <Outlet />
        </main>
        <Toaster theme="dark" position="top-right" richColors closeButton />
      </AuthProvider>
    </QueryClientProvider>
  );
}
