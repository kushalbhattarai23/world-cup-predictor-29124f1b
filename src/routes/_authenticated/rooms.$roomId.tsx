import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase, type Match, type Room } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MatchCard } from "@/components/MatchCard";
import { PredictionDialog } from "@/components/PredictionDialog";
import { ArrowLeft, UserPlus, RefreshCw, X, LogOut, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rooms/$roomId")({
  component: RoomDetail,
});

interface RoomPred {
  id: string;
  user_id: string;
  match_id: string;
  pick: "team_a" | "team_b" | "draw";
  score_a: number | null;
  score_b: number | null;
  pen_winner: "team_a" | "team_b" | null;
  points_awarded: number;
}

function RoomDetail() {
  const { roomId } = Route.useParams();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState<Match | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const { data: room } = useQuery({
    queryKey: ["room", roomId],
    queryFn: async () => {
      const { data, error } = await supabase.from("football_rooms").select("*").eq("id", roomId).maybeSingle();
      if (error) throw error;
      return data as Room | null;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["room-members", roomId],
    queryFn: async () => {
      const { data: m, error } = await supabase
        .from("football_room_members")
        .select("user_id")
        .eq("room_id", roomId);
      if (error) throw error;
      const ids = (m ?? []).map((r: { user_id: string }) => r.user_id);
      if (ids.length === 0) return [] as { user_id: string; username: string }[];
      const { data: profs } = await supabase
        .from("football_profiles")
        .select("id, username")
        .in("id", ids);
      const profMap = new Map<string, string>(
        ((profs ?? []) as { id: string; username: string }[]).map((p) => [p.id, p.username]),
      );
      return ids.map((id) => ({ user_id: id, username: profMap.get(id) ?? "Player" }));
    },
  });

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

  const { data: roomPreds = [] } = useQuery({
    queryKey: ["room-preds", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("football_room_predictions")
        .select("*")
        .eq("room_id", roomId);
      if (error) throw error;
      return (data ?? []) as RoomPred[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "football_room_predictions", filter: `room_id=eq.${roomId}` }, () =>
        qc.invalidateQueries({ queryKey: ["room-preds", roomId] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "football_room_members", filter: `room_id=eq.${roomId}` }, () =>
        qc.invalidateQueries({ queryKey: ["room-members", roomId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomId, qc]);

  const myPreds = useMemo(
    () => new Map(roomPreds.filter((p) => p.user_id === userId).map((p) => [p.match_id, p])),
    [roomPreds, userId],
  );

  const isOwner = room?.owner_id === userId;

  const leaderboard = useMemo(() => {
    const acc = new Map<string, number>();
    for (const p of roomPreds) acc.set(p.user_id, (acc.get(p.user_id) ?? 0) + (p.points_awarded ?? 0));
    return members
      .map((m) => ({ ...m, points: acc.get(m.user_id) ?? 0 }))
      .sort((a, b) => b.points - a.points || a.username.localeCompare(b.username));
  }, [members, roomPreds]);

  const inviteByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const { data: profs } = await supabase
        .from("football_profiles")
        .select("id, username")
        .ilike("username", inviteEmail.trim());
      let targetId: string | null = profs && profs[0] ? (profs[0] as { id: string }).id : null;
      if (!targetId) {
        // fall back: look up by email-prefix username
        const prefix = inviteEmail.trim().split("@")[0];
        const { data: p2 } = await supabase
          .from("football_profiles")
          .select("id")
          .eq("username", prefix)
          .maybeSingle();
        targetId = p2 ? (p2 as { id: string }).id : null;
      }
      if (!targetId) { toast.error("Player not found. Ask the admin to provision them first."); return; }
      const { error } = await supabase
        .from("football_room_members")
        .insert({ room_id: roomId, user_id: targetId });
      if (error) {
        if (error.code === "23505" || /duplicate/i.test(error.message)) {
          toast.info("They're already in this room.");
        } else {
          toast.error(error.message);
        }
        return;
      }
      toast.success("Invited");
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["room-members", roomId] });
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (uid: string) => {
    if (uid === room?.owner_id) { toast.error("Owner cannot be removed"); return; }
    const { error } = await supabase
      .from("football_room_members")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", uid);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["room-members", roomId] });
  };

  const leaveRoom = async () => {
    if (isOwner) { toast.error("Owners cannot leave their own room"); return; }
    const { error } = await supabase
      .from("football_room_members")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", userId!);
    if (error) toast.error(error.message);
    else { toast.success("Left room"); window.location.href = "/rooms"; }
  };

  const syncFromGlobal = async () => {
    if (!userId) return;
    const { data: g } = await supabase
      .from("football_predictions")
      .select("*")
      .eq("user_id", userId);
    const futureScheduled = new Set(
      matches.filter((m) => m.status === "scheduled" && new Date(m.kickoff_at).getTime() > Date.now()).map((m) => m.id),
    );
    const toUpsert = (g ?? [])
      .filter((p: { match_id: string }) => futureScheduled.has(p.match_id))
      .map((p: { match_id: string; pick: string; score_a: number | null; score_b: number | null; pen_winner: string | null }) => ({
        room_id: roomId,
        user_id: userId,
        match_id: p.match_id,
        pick: p.pick,
        score_a: p.score_a,
        score_b: p.score_b,
        pen_winner: p.pen_winner,
      }));
    if (toUpsert.length === 0) { toast.info("No future scheduled picks to sync."); return; }
    const { error } = await supabase
      .from("football_room_predictions")
      .upsert(toUpsert, { onConflict: "room_id,user_id,match_id" });
    if (error) toast.error(error.message);
    else { toast.success(`Synced ${toUpsert.length} picks`); qc.invalidateQueries({ queryKey: ["room-preds", roomId] }); }
  };

  const upcoming = matches.filter((m) => m.status === "scheduled");

  return (
    <div className="space-y-6">
      <Link to="/rooms" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All rooms
      </Link>

      <header className="rounded-2xl border border-border bg-pitch-gradient p-6">
        <h1 className="font-display text-4xl tracking-wider">{room?.name ?? "Room"}</h1>
        {room?.description && <p className="mt-1 text-sm text-primary-foreground/80">{room.description}</p>}
        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wider">
          <span className="rounded-md bg-background/40 px-2 py-1">Win {room?.points_outcome}</span>
          <span className="rounded-md bg-background/40 px-2 py-1">Exact +{room?.points_exact_bonus}</span>
          <span className="rounded-md bg-background/40 px-2 py-1">Diff +{room?.points_goal_diff_bonus}</span>
          <span className="rounded-md bg-background/40 px-2 py-1">KO ×{room?.knockout_multiplier}</span>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={syncFromGlobal} className="flex items-center gap-2 rounded-lg bg-background/50 px-3 py-1.5 text-xs font-semibold hover:bg-background/70">
            <RefreshCw className="h-3.5 w-3.5" /> Sync global picks
          </button>
          {!isOwner && (
            <button onClick={leaveRoom} className="flex items-center gap-2 rounded-lg bg-accent/20 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/30">
              <LogOut className="h-3.5 w-3.5" /> Leave
            </button>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-3 font-display text-2xl">Upcoming · room picks</h2>
          {upcoming.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No upcoming matches.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-1">
              {upcoming.slice(0, 8).map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  myPick={myPreds.get(m.id) ?? null}
                  onPredict={() => setOpen(m)}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-display text-xl tracking-wider">Room leaderboard</h3>
            <ul className="mt-3 space-y-2">
              {leaderboard.map((r, i) => (
                <li key={r.user_id} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${r.user_id === userId ? "bg-primary/15" : "bg-background/30"}`}>
                  <span className="flex items-center gap-2">
                    <span className="w-5 font-display text-base text-muted-foreground">{i + 1}</span>
                    <span className="font-medium">{r.username}</span>
                  </span>
                  <span className="font-display text-lg text-primary">{r.points}</span>
                </li>
              ))}
              {leaderboard.length === 0 && <li className="py-3 text-center text-xs text-muted-foreground">No members yet.</li>}
            </ul>
          </div>

          {isOwner && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-display text-xl tracking-wider">Members</h3>
              <form onSubmit={inviteByEmail} className="mt-3 flex gap-2">
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="player email or username"
                  className="flex-1 rounded-lg border border-border bg-input px-3 py-2 text-xs outline-none focus:border-primary"
                />
                <button disabled={inviting} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:brightness-110">
                  {inviting ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                  Invite
                </button>
              </form>
              <ul className="mt-4 space-y-1">
                {members.map((m) => (
                  <li key={m.user_id} className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs">
                    <span>
                      {m.username}
                      {m.user_id === room?.owner_id && <span className="ml-2 rounded bg-gold/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gold">owner</span>}
                    </span>
                    {m.user_id !== room?.owner_id && (
                      <button onClick={() => removeMember(m.user_id)} className="text-muted-foreground hover:text-accent">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[10px] text-muted-foreground">
                Players must already have an account (provisioned by an admin). Use their username or email prefix.
              </p>
            </div>
          )}
        </aside>
      </div>

      {open && userId && (
        <PredictionDialog
          open={!!open}
          match={open}
          userId={userId}
          roomId={roomId}
          existing={myPreds.get(open.id) ?? null}
          onClose={() => setOpen(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["room-preds", roomId] })}
        />
      )}
    </div>
  );
}
