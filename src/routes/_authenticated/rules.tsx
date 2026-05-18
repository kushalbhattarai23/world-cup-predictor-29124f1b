import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rules")({
  component: RulesPage,
});

function RulesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-start gap-4">
        <div className="rounded-xl bg-primary/15 p-3"><BookOpen className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="font-display text-4xl tracking-wider">Rules & Scoring</h1>
          <p className="text-sm text-muted-foreground">How points are awarded across the tournament.</p>
        </div>
      </header>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-2xl">Global scoring</h2>
        <ul className="space-y-3 text-sm">
          <Item title="Correct outcome" points="+3 pts" desc="Pick the winning team (or draw in group stage)." />
          <Item title="Exact score bonus" points="+2 pts" desc="Get the final score right and stack a bonus on top." />
          <Item title="No partial credit" points="0 pts" desc="Wrong outcome means zero, regardless of scoreline." />
        </ul>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-2xl">Group stage vs knockout</h2>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Group stage:</strong> draws are allowed. Pick a winner or a draw.
        </p>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Knockout:</strong> a winner is required. If your predicted scoreline ends level, you must also pick the
          penalty shootout winner. Calling the shootout correctly is worth an extra <span className="text-gold font-semibold">+1 pt</span>.
        </p>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-2xl">Private rooms</h2>
        <p className="text-sm text-muted-foreground">
          Room owners set custom scoring — outcome value, exact-score bonus, goal-difference bonus, and a knockout multiplier.
          Room picks are stored separately from your global picks. When you join a room, future global picks can be synced into the room
          (only for matches that haven't started yet).
        </p>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-2xl">Locking</h2>
        <p className="text-sm text-muted-foreground">
          Predictions lock at kickoff. After a match starts, picks can't be created or edited. Admins enter the final score and points
          are recalculated automatically.
        </p>
      </section>
    </div>
  );
}

function Item({ title, points, desc }: { title: string; points: string; desc: string }) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-background/30 p-3">
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <span className="shrink-0 rounded-md bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">{points}</span>
    </li>
  );
}
