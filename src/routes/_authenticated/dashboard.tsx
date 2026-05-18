import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type Match, type Prediction } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MatchCard } from "@/components/MatchCard";
import { PredictionDialog } from "@/components/PredictionDialog";
import { Calendar, Target, Trophy, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { userId, profile } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState<Match | null>(null);

  const { data: matches = [] } = useQuery({
    queryKey: ["dashboard-matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("football_matches")
        .select("*")
        .order("kickoff_at", { ascending: true })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as Match[];
    },
  });

  const { data: preds = [] } = useQuery({
    queryKey: ["my-predictions", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("football_predictions")
        .select("*")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []) as Prediction[];
    },
  });

  const { data: rank } = useQuery({
    queryKey: ["my-rank", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("football_predictions")
        .select("user_id, points_awarded");
      const totals = new Map<string, number>();
      for (const r of (data ?? []) as { user_id: string; points_awarded: number }[]) {
        totals.set(r.user_id, (totals.get(r.user_id) ?? 0) + (r.points_awarded ?? 0));
      }
      const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
      const myIdx = sorted.findIndex(([uid]) => uid === userId);
      const myPoints = totals.get(userId!) ?? 0;
      return { rank: myIdx >= 0 ? myIdx + 1 : sorted.length + 1, points: myPoints, total: sorted.length };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("dash-predictions")
      .on("postgres_changes", { event: "*", schema: "public", table: "football_predictions" }, () => {
        qc.invalidateQueries({ queryKey: ["my-rank"] });
        qc.invalidateQueries({ queryKey: ["my-predictions"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "football_matches" }, () => {
        qc.invalidateQueries({ queryKey: ["dashboard-matches"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const predMap = useMemo(() => new Map(preds.map((p) => [p.match_id, p])), [preds]);
  const upcoming = matches.filter((m) => m.status === "scheduled");
  const finishedCount = preds.filter((p) => p.points_awarded > 0).length;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border bg-pitch-gradient p-8 shadow-glow">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">
          Welcome back
        </p>
        <h1 className="mt-1 font-display text-4xl tracking-wider md:text-5xl">
          {profile?.full_name || profile?.username || "Player"}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-primary-foreground/80">
          The world's stage. Your call. Make every pick count.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Trophy className="h-5 w-5" />} label="Global Rank" value={rank ? `#${rank.rank}` : "—"} sub={rank ? `of ${rank.total}` : ""} tone="gold" />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Points" value={rank?.points ?? 0} tone="primary" />
        <StatCard icon={<Target className="h-5 w-5" />} label="Picks made" value={preds.length} />
        <StatCard icon={<Calendar className="h-5 w-5" />} label="Wins scored" value={finishedCount} />
      </div>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-2xl tracking-wider">Upcoming fixtures</h2>
          <span className="text-xs text-muted-foreground">{upcoming.length} scheduled</span>
        </div>
        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No scheduled matches yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {upcoming.slice(0, 6).map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                myPick={predMap.get(m.id) ?? null}
                onPredict={() => setOpen(m)}
              />
            ))}
          </div>
        )}
      </section>

      {open && userId && (
        <PredictionDialog
          open={!!open}
          match={open}
          userId={userId}
          existing={predMap.get(open.id) ?? null}
          onClose={() => setOpen(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["my-predictions", userId] })}
        />
      )}
    </div>
  );
}

function StatCard({
  icon, label, value, sub, tone,
}: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; tone?: "gold" | "primary" }) {
  const ring =
    tone === "gold" ? "ring-1 ring-gold/30" : tone === "primary" ? "ring-1 ring-primary/30" : "";
  const iconTone =
    tone === "gold" ? "text-gold bg-gold/10" : tone === "primary" ? "text-primary bg-primary/10" : "text-muted-foreground bg-muted";
  return (
    <div className={`rounded-xl border border-border bg-card p-5 ${ring}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`rounded-md p-1.5 ${iconTone}`}>{icon}</span>
      </div>
      <div className="mt-3 font-display text-4xl tracking-wider">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
