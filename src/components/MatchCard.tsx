import { format } from "date-fns";
import type { Match, MatchStatus } from "@/integrations/supabase/client";

const flag = (s: string | null) =>
  s ? <span className="text-lg leading-none">{s}</span> : null;

export function StageBadge({ stage }: { stage: string }) {
  const label =
    stage === "group" ? "Group" :
    stage === "round_of_32" ? "R32" :
    stage === "round_of_16" ? "R16" :
    stage === "quarter_final" ? "QF" :
    stage === "semi_final" ? "SF" :
    stage === "third_place" ? "3rd" :
    stage === "final" ? "Final" : stage;
  return (
    <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">
      {label}
    </span>
  );
}

export function StatusDot({ status }: { status: MatchStatus }) {
  if (status === "live")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-live/15 px-2 py-0.5 text-[10px] font-bold uppercase text-live">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-live" />
        Live
      </span>
    );
  if (status === "finished")
    return <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">FT</span>;
  if (status === "cancelled")
    return <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">Off</span>;
  return null;
}

export function MatchCard({
  match,
  onPredict,
  myPick,
  pointsLabel,
  right,
}: {
  match: Match;
  onPredict?: () => void;
  myPick?: { pick: string; score_a: number | null; score_b: number | null; points_awarded?: number } | null;
  pointsLabel?: string;
  right?: React.ReactNode;
}) {
  const ko = new Date(match.kickoff_at);
  const locked = match.status !== "scheduled" || ko.getTime() <= Date.now();
  return (
    <div className="group rounded-xl border border-border bg-card/70 p-4 transition-all hover:border-primary/40">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StageBadge stage={match.stage} />
          {match.group_name && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {match.group_name}
            </span>
          )}
          <StatusDot status={match.status} />
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          <div>{format(ko, "EEE, MMM d")}</div>
          <div className="font-medium text-foreground/80">{format(ko, "p")}</div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex items-center gap-2 truncate">
          {flag(match.team_a_flag)}
          <span className="truncate font-display text-xl tracking-wide">{match.team_a}</span>
        </div>
        <div className="text-center">
          {match.status === "finished" || match.status === "live" ? (
            <div className="font-display text-3xl text-primary">
              {match.score_a ?? 0}<span className="px-1 text-muted-foreground">–</span>{match.score_b ?? 0}
              {match.pen_a !== null && match.pen_b !== null && (
                <div className="text-[10px] font-sans font-semibold text-gold">
                  ({match.pen_a}–{match.pen_b} pens)
                </div>
              )}
            </div>
          ) : (
            <span className="font-display text-2xl text-muted-foreground">vs</span>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 truncate">
          <span className="truncate text-right font-display text-xl tracking-wide">{match.team_b}</span>
          {flag(match.team_b_flag)}
        </div>
      </div>

      {(match.stadium || match.city) && (
        <p className="mt-2 truncate text-center text-[11px] text-muted-foreground">
          {[match.stadium, match.city].filter(Boolean).join(" · ")}
        </p>
      )}

      {(myPick || onPredict || right) && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
          <div className="text-xs">
            {myPick ? (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Your pick:</span>
                <span className="font-semibold text-primary">
                  {myPick.pick === "team_a" ? match.team_a : myPick.pick === "team_b" ? match.team_b : "Draw"}
                </span>
                {myPick.score_a !== null && myPick.score_b !== null && (
                  <span className="text-muted-foreground">({myPick.score_a}–{myPick.score_b})</span>
                )}
                {pointsLabel && match.status === "finished" && (
                  <span className="rounded-md bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">
                    +{myPick.points_awarded ?? 0} {pointsLabel}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">{locked ? "No pick made" : "Make your pick"}</span>
            )}
          </div>
          {right ?? (
            onPredict && !locked && (
              <button
                onClick={onPredict}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110"
              >
                {myPick ? "Edit pick" : "Predict"}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
