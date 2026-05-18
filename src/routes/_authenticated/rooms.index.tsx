import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase, type Room } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Users, Plus, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rooms/")({
  component: RoomsList,
});

const schema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional(),
  points_outcome: z.number().int().min(1).max(20),
  points_exact_bonus: z.number().int().min(0).max(20),
  points_goal_diff_bonus: z.number().int().min(0).max(20),
  knockout_multiplier: z.number().min(1).max(5),
});
type Vals = z.infer<typeof schema>;

function RoomsList() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ["rooms", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("football_rooms")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Room[];
    },
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Vals>({
    resolver: zodResolver(schema),
    defaultValues: { points_outcome: 3, points_exact_bonus: 2, points_goal_diff_bonus: 1, knockout_multiplier: 1 },
  });

  const onCreate = async (vals: Vals) => {
    const { data, error } = await supabase
      .from("football_rooms")
      .insert({ ...vals, owner_id: userId! })
      .select("id")
      .single();
    if (error) { toast.error(error.message); return; }
    // Add owner as member
    await supabase.from("football_room_members").insert({ room_id: data!.id, user_id: userId! });
    toast.success("Room created");
    reset();
    setCreating(false);
    qc.invalidateQueries({ queryKey: ["rooms"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wider">Private Rooms</h1>
          <p className="text-sm text-muted-foreground">Run your own league with custom scoring.</p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          New room
        </button>
      </div>

      {creating && (
        <form onSubmit={handleSubmit(onCreate)} className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-2xl">New room</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input {...register("name")} className="input" />
              {errors.name && <Err msg={errors.name.message} />}
            </Field>
            <Field label="Description">
              <input {...register("description")} className="input" />
            </Field>
            <Field label="Outcome pts">
              <input type="number" {...register("points_outcome", { valueAsNumber: true })} className="input" />
            </Field>
            <Field label="Exact bonus">
              <input type="number" {...register("points_exact_bonus", { valueAsNumber: true })} className="input" />
            </Field>
            <Field label="Goal-diff bonus">
              <input type="number" {...register("points_goal_diff_bonus", { valueAsNumber: true })} className="input" />
            </Field>
            <Field label="Knockout multiplier">
              <input type="number" step="0.25" {...register("knockout_multiplier", { valueAsNumber: true })} className="input" />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreating(false)} className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground">Cancel</button>
            <button disabled={isSubmitting} className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </button>
          </div>
          <style>{`.input{width:100%;border-radius:.5rem;border:1px solid var(--color-border);background:var(--color-input);padding:.55rem .75rem;font-size:.875rem;outline:none}`}</style>
        </form>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-border p-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          You haven't joined any rooms yet. Create one above.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r) => (
            <Link
              key={r.id}
              to="/rooms/$roomId"
              params={{ roomId: r.id }}
              className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-glow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-2xl tracking-wider">{r.name}</h3>
                  {r.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.description}</p>}
                </div>
                <Users className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wider">
                <Chip>Win {r.points_outcome}</Chip>
                <Chip>Exact +{r.points_exact_bonus}</Chip>
                <Chip>Diff +{r.points_goal_diff_bonus}</Chip>
                <Chip>KO ×{r.knockout_multiplier}</Chip>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function Err({ msg }: { msg?: string }) { return <p className="mt-1 text-xs text-accent">{msg}</p>; }
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-secondary px-2 py-1 text-secondary-foreground">{children}</span>;
}
