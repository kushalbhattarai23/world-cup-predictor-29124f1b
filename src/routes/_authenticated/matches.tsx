import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type Match, type Prediction } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MatchCard } from "@/components/MatchCard";
import { PredictionDialog } from "@/components/PredictionDialog";

type Tab = "upcoming" | "live" | "finished";

export const Route = createFileRoute("/_authenticated/matches")({
  component: MatchesPage,
});

function MatchesPage() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [open, setOpen] = useState<Match | null>(null);

  const { data: matches = [] } = useQuery({
    queryKey: ["all-matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("football_matches")
        .select("*")
        .order("kickoff_at", { ascending: true });
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

  useEffect(() => {
    const ch = supabase
      .channel("matches-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "football_matches" }, () =>
        qc.invalidateQueries({ queryKey: ["all-matches"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "football_predictions" }, () =>
        qc.invalidateQueries({ queryKey: ["my-predictions"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const predMap = useMemo(() => new Map(preds.map((p) => [p.match_id, p])), [preds]);
  const filtered = matches.filter((m) =>
    tab === "live" ? m.status === "live" :
    tab === "finished" ? m.status === "finished" :
    m.status === "scheduled" || m.status === "cancelled"
  );
  const counts = {
    upcoming: matches.filter((m) => m.status === "scheduled").length,
    live: matches.filter((m) => m.status === "live").length,
    finished: matches.filter((m) => m.status === "finished").length,
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl tracking-wider">Fixtures</h1>
        <p className="text-sm text-muted-foreground">All World Cup 2026 matches.</p>
      </header>

      <div className="inline-flex rounded-xl border border-border bg-card p-1">
        {(["upcoming", "live", "finished"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition-all ${
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t} <span className="ml-1 text-[10px] opacity-70">({counts[t]})</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No matches in this view.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              myPick={predMap.get(m.id) ?? null}
              pointsLabel="pts"
              onPredict={() => setOpen(m)}
            />
          ))}
        </div>
      )}

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
