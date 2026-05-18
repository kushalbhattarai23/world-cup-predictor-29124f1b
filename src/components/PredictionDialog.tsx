import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase, type Match, type PredictionPick } from "@/integrations/supabase/client";
import { Loader2, X } from "lucide-react";

const baseSchema = z.object({
  pick: z.enum(["team_a", "team_b", "draw"]),
  score_a: z.number().int().min(0).max(20),
  score_b: z.number().int().min(0).max(20),
  pen_winner: z.enum(["team_a", "team_b"]).nullable().optional(),
});
type Vals = z.infer<typeof baseSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  match: Match;
  userId: string;
  roomId?: string;
  existing?: { pick: PredictionPick; score_a: number | null; score_b: number | null; pen_winner?: "team_a" | "team_b" | null } | null;
  onSaved: () => void;
}

export function PredictionDialog({ open, onClose, match, userId, roomId, existing, onSaved }: Props) {
  const isKnockout = match.stage !== "group";
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<Vals>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      pick: existing?.pick ?? "team_a",
      score_a: existing?.score_a ?? 1,
      score_b: existing?.score_b ?? 0,
      pen_winner: existing?.pen_winner ?? null,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        pick: existing?.pick ?? "team_a",
        score_a: existing?.score_a ?? 1,
        score_b: existing?.score_b ?? 0,
        pen_winner: existing?.pen_winner ?? null,
      });
    }
  }, [open, existing, reset]);

  const pick = watch("pick");
  const scoreA = Number(watch("score_a"));
  const scoreB = Number(watch("score_b"));
  const drawByScore = scoreA === scoreB;

  // Auto-sync pick with score for group; for knockout, force a winner
  useEffect(() => {
    if (!isKnockout) {
      if (scoreA > scoreB && pick !== "team_a") setValue("pick", "team_a");
      else if (scoreB > scoreA && pick !== "team_b") setValue("pick", "team_b");
      else if (scoreA === scoreB && pick !== "draw") setValue("pick", "draw");
    }
  }, [scoreA, scoreB, isKnockout, pick, setValue]);

  if (!open) return null;

  const onSubmit = async (vals: Vals) => {
    if (isKnockout && vals.pick === "draw") {
      toast.error("Knockout matches require a winner");
      return;
    }
    if (isKnockout && drawByScore && !vals.pen_winner) {
      toast.error("Pick a penalty shootout winner for a drawn knockout");
      return;
    }
    setSaving(true);
    const table = roomId ? "football_room_predictions" : "football_predictions";
    const payload: Record<string, unknown> = {
      user_id: userId,
      match_id: match.id,
      pick: vals.pick,
      score_a: vals.score_a,
      score_b: vals.score_b,
      pen_winner: isKnockout && drawByScore ? vals.pen_winner : null,
    };
    if (roomId) payload.room_id = roomId;

    const onConflict = roomId ? "room_id,user_id,match_id" : "user_id,match_id";
    const { error } = await supabase.from(table).upsert(payload, { onConflict });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pick saved");
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-glow">
        <div className="mb-5 flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {isKnockout ? "Knockout pick" : "Group stage pick"}
            </p>
            <h2 className="font-display text-2xl tracking-wider">
              {match.team_a} vs {match.team_b}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Exact score
            </label>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="text-center">
                <div className="mb-1 truncate text-xs text-muted-foreground">{match.team_a}</div>
                <input
                  type="number"
                  min={0}
                  max={20}
                  {...register("score_a")}
                  className="w-full rounded-lg border border-border bg-input px-3 py-3 text-center font-display text-3xl outline-none focus:border-primary"
                />
              </div>
              <span className="font-display text-2xl text-muted-foreground">–</span>
              <div className="text-center">
                <div className="mb-1 truncate text-xs text-muted-foreground">{match.team_b}</div>
                <input
                  type="number"
                  min={0}
                  max={20}
                  {...register("score_b")}
                  className="w-full rounded-lg border border-border bg-input px-3 py-3 text-center font-display text-3xl outline-none focus:border-primary"
                />
              </div>
            </div>
            {(errors.score_a || errors.score_b) && (
              <p className="mt-1 text-xs text-accent">Scores must be 0–20</p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Winner
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: "team_a", label: match.team_a },
                { v: "draw", label: "Draw", disabled: isKnockout },
                { v: "team_b", label: match.team_b },
              ] as { v: PredictionPick; label: string; disabled?: boolean }[]).map((opt) => (
                <button
                  type="button"
                  key={opt.v}
                  disabled={opt.disabled}
                  onClick={() => setValue("pick", opt.v)}
                  className={`truncate rounded-lg border px-3 py-2 text-sm font-semibold transition-all ${
                    pick === opt.v
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-input text-muted-foreground hover:text-foreground"
                  } ${opt.disabled ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {isKnockout && (
              <p className="mt-1 text-[11px] text-muted-foreground">Draws not allowed in knockout — pick a winner.</p>
            )}
          </div>

          {isKnockout && drawByScore && (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gold">
                Penalty shootout winner
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { v: "team_a" as const, label: match.team_a },
                  { v: "team_b" as const, label: match.team_b },
                ]).map((opt) => (
                  <button
                    type="button"
                    key={opt.v}
                    onClick={() => setValue("pen_winner", opt.v)}
                    className={`truncate rounded-lg border px-3 py-2 text-sm font-semibold transition-all ${
                      watch("pen_winner") === opt.v
                        ? "border-gold bg-gold/15 text-gold"
                        : "border-border bg-input text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save pick
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
