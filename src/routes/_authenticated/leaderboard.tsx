import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Crown, Medal } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  component: LeaderboardPage,
});

interface Row {
  user_id: string;
  username: string;
  points: number;
  picks: number;
}

function LeaderboardPage() {
  const { userId } = useAuth();
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const [{ data: preds }, { data: profiles }] = await Promise.all([
        supabase.from("football_predictions").select("user_id, points_awarded"),
        supabase.from("football_profiles").select("id, username"),
      ]);
      const profMap = new Map<string, string>(
        ((profiles ?? []) as { id: string; username: string }[]).map((p) => [p.id, p.username]),
      );
      const acc = new Map<string, { points: number; picks: number }>();
      for (const r of (preds ?? []) as { user_id: string; points_awarded: number }[]) {
        const cur = acc.get(r.user_id) ?? { points: 0, picks: 0 };
        cur.points += r.points_awarded ?? 0;
        cur.picks += 1;
        acc.set(r.user_id, cur);
      }
      const rows: Row[] = [...acc.entries()].map(([uid, v]) => ({
        user_id: uid,
        username: profMap.get(uid) ?? "Player",
        points: v.points,
        picks: v.picks,
      }));
      rows.sort((a, b) => b.points - a.points || a.username.localeCompare(b.username));
      return rows;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("lb")
      .on("postgres_changes", { event: "*", schema: "public", table: "football_predictions" }, () =>
        qc.invalidateQueries({ queryKey: ["leaderboard"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl tracking-wider">Global Leaderboard</h1>
        <p className="text-sm text-muted-foreground">Live · refreshes as scores are posted.</p>
      </header>

      {isLoading ? (
        <div className="rounded-xl border border-border p-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No predictions yet. Be the first.
        </div>
      ) : (
        <>
          {podium.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-3">
              {[1, 0, 2].map((i) => {
                const r = podium[i];
                if (!r) return <div key={i} />;
                const rank = i + 1;
                const tone =
                  rank === 1 ? "border-gold/60 bg-gold/10 shadow-glow" :
                  rank === 2 ? "border-border bg-card" :
                  "border-accent/40 bg-accent/5";
                const height = rank === 1 ? "sm:mt-0" : rank === 2 ? "sm:mt-6" : "sm:mt-10";
                return (
                  <div key={r.user_id} className={`rounded-2xl border p-6 text-center ${tone} ${height}`}>
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-background">
                      {rank === 1 ? <Crown className="h-6 w-6 text-gold" /> : <Medal className={`h-6 w-6 ${rank === 2 ? "text-muted-foreground" : "text-accent"}`} />}
                    </div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rank {rank}</div>
                    <div className="mt-1 truncate font-display text-2xl tracking-wider">{r.username}</div>
                    <div className="mt-2 font-display text-4xl text-primary">{r.points}</div>
                    <div className="text-xs text-muted-foreground">{r.picks} picks</div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 text-left">Rank</th>
                  <th className="px-4 py-3 text-left">Player</th>
                  <th className="px-4 py-3 text-right">Picks</th>
                  <th className="px-4 py-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isMe = r.user_id === userId;
                  return (
                    <tr key={r.user_id} className={`border-b border-border/50 ${isMe ? "bg-primary/10" : ""}`}>
                      <td className="px-4 py-3 font-display text-lg">{i + 1}</td>
                      <td className="px-4 py-3 font-medium">
                        {r.username} {isMe && <span className="ml-1 text-[10px] font-semibold uppercase text-primary">you</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{r.picks}</td>
                      <td className="px-4 py-3 text-right font-display text-xl text-primary">{r.points}</td>
                    </tr>
                  );
                })}
                {rest.length === 0 && rows.length <= 3 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-xs text-muted-foreground">Top players shown above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
