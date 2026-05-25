import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type Match, type Prediction, type MatchStage } from "@/integrations/supabase/client";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fan-predictions")({
  component: FanPredictionsPage,
});

const KO_STAGES: MatchStage[] = [
  "round_of_32",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "final",
];

// Label shown for the stage a winner of a match in STAGE reaches.
const REACHED_LABEL: Record<MatchStage, string> = {
  group: "Round of 32",
  round_of_32: "Round of 16",
  round_of_16: "Quarter-finals",
  quarter_final: "Semi-finals",
  semi_final: "Final",
  third_place: "Third place",
  final: "Champion",
};

function FanPredictionsPage() {
  const qc = useQueryClient();

  const { data: matches = [] } = useQuery({
    queryKey: ["ko-matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("football_matches")
        .select("*")
        .in("stage", KO_STAGES)
        .order("kickoff_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Match[];
    },
  });

  const matchIds = useMemo(() => matches.map((m) => m.id), [matches]);

  const { data: preds = [] } = useQuery({
    queryKey: ["all-ko-predictions", matchIds.length],
    enabled: matchIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("football_predictions")
        .select("match_id,user_id,pick,pen_winner")
        .in("match_id", matchIds);
      if (error) throw error;
      return (data ?? []) as Pick<Prediction, "match_id" | "user_id" | "pick" | "pen_winner">[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("fan-preds")
      .on("postgres_changes", { event: "*", schema: "public", table: "football_predictions" }, () =>
        qc.invalidateQueries({ queryKey: ["all-ko-predictions"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  // Group predictions by match, compute winner pick → team name.
  const stageData = useMemo(() => {
    const byMatch = new Map<string, typeof preds>();
    for (const p of preds) {
      const arr = byMatch.get(p.match_id) ?? [];
      arr.push(p);
      byMatch.set(p.match_id, arr);
    }

    const result: { stage: MatchStage; label: string; teams: { team: string; pct: number; count: number }[]; total: number }[] = [];

    for (const stage of KO_STAGES) {
      const stageMatches = matches.filter((m) => m.stage === stage);
      const tally = new Map<string, number>();
      let total = 0;

      for (const m of stageMatches) {
        const ps = byMatch.get(m.id) ?? [];
        for (const p of ps) {
          total++;
          let winnerTeam: string | null = null;
          if (p.pick === "team_a") winnerTeam = m.team_a;
          else if (p.pick === "team_b") winnerTeam = m.team_b;
          else if (p.pick === "draw" && p.pen_winner) {
            winnerTeam = p.pen_winner === "team_a" ? m.team_a : m.team_b;
          }
          if (winnerTeam) tally.set(winnerTeam, (tally.get(winnerTeam) ?? 0) + 1);
        }
      }

      const denom = total || 1;
      const teams = [...tally.entries()]
        .map(([team, count]) => ({ team, count, pct: (count / denom) * 100 }))
        .sort((a, b) => b.pct - a.pct);

      result.push({ stage, label: REACHED_LABEL[stage], teams, total });
    }

    return result;
  }, [matches, preds]);

  const totalBrackets = useMemo(() => new Set(preds.map((p) => p.user_id)).size, [preds]);

  return (
    <div className="space-y-8">
      <header className="rounded-2xl border border-border bg-pitch-gradient p-8 shadow-glow">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">
          <Trophy className="h-4 w-4" /> Fan Predictions
        </div>
        <h1 className="mt-1 font-display text-4xl tracking-wider md:text-5xl">The People's Bracket</h1>
        <p className="mt-2 max-w-2xl text-sm text-primary-foreground/80">
          Based on {totalBrackets.toLocaleString()} player picks · Updated live · Most commonly predicted teams to reach each knockout stage.
        </p>
      </header>

      {stageData.every((s) => s.total === 0) ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No knockout predictions yet. Once players start picking, the global bracket appears here.
        </div>
      ) : (
        <div className="space-y-6">
          {stageData.map((s) => (
            <StageBlock key={s.stage} label={s.label} teams={s.teams} total={s.total} />
          ))}
        </div>
      )}
    </div>
  );
}

function StageBlock({ label, teams, total }: { label: string; teams: { team: string; pct: number; count: number }[]; total: number }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-end justify-between">
        <h2 className="font-display text-2xl tracking-wider">{label}</h2>
        <span className="text-xs text-muted-foreground">{total.toLocaleString()} picks</span>
      </div>
      {teams.length === 0 ? (
        <p className="text-sm text-muted-foreground">No picks yet for this stage.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {teams.map((t) => (
            <TeamChip key={t.team} team={t.team} pct={t.pct} />
          ))}
        </div>
      )}
    </section>
  );
}

function TeamChip({ team, pct }: { team: string; pct: number }) {
  const intensity = Math.min(100, Math.max(8, pct));
  const tone =
    pct >= 40 ? "border-gold/40 bg-gold/10 text-gold" :
    pct >= 20 ? "border-primary/40 bg-primary/10 text-primary" :
    "border-border bg-background text-foreground";
  return (
    <div
      className={`relative overflow-hidden rounded-lg border px-3 py-2 text-sm font-semibold ${tone}`}
      title={`${team} — ${pct.toFixed(1)}%`}
    >
      <div
        className="absolute inset-y-0 left-0 -z-0 bg-current opacity-10"
        style={{ width: `${intensity}%` }}
      />
      <span className="relative z-10">{team}</span>
      <span className="relative z-10 ml-2 font-mono text-xs opacity-80">{pct.toFixed(1)}%</span>
    </div>
  );
}
