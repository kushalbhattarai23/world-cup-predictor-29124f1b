import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase, type Match, type MatchStage, type MatchStatus } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import worldCup from "@/data/worldcup.json";
import { Shield, UserCog, Database, Save, Loader2, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

interface ProfileRow {
  id: string;
  username: string;
  full_name: string | null;
  is_active: boolean;
}

const SUPABASE_URL = "https://gzampnmelaeqhwzzsvam.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6YW1wbm1lbGFlcWh3enpzdmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc3NTMyNjcsImV4cCI6MjA2MzMyOTI2N30.x5KnK9mtIDf-ZNiGKSGlRqwjP57WMZ0Jx_ZdWWk3--8";

function detectStage(round: string): MatchStage {
  const r = round.toLowerCase();
  if (r.includes("final") && !r.includes("semi") && !r.includes("quarter") && !r.includes("third")) return "final";
  if (r.includes("third")) return "third_place";
  if (r.includes("semi")) return "semi_final";
  if (r.includes("quarter")) return "quarter_final";
  if (r.includes("round of 16")) return "round_of_16";
  if (r.includes("round of 32")) return "round_of_32";
  return "group";
}

function parseKickoff(date: string, time: string): string {
  // time like "13:00 UTC-6"
  const m = time.match(/^(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})/);
  if (!m) return `${date}T${time.split(" ")[0]}:00Z`;
  const [, h, mm, off] = m;
  const offNum = parseInt(off, 10);
  const sign = offNum >= 0 ? "+" : "-";
  const abs = Math.abs(offNum).toString().padStart(2, "0");
  return `${date}T${h.padStart(2, "0")}:${mm}:00${sign}${abs}:00`;
}

function AdminPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <Shield className="mx-auto h-8 w-8 text-accent" />
        <h2 className="mt-2 font-display text-2xl">Admin only</h2>
        <p className="mt-1 text-sm text-muted-foreground">You don't have admin permissions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="flex items-start gap-4">
        <div className="rounded-xl bg-primary/15 p-3"><Shield className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="font-display text-4xl tracking-wider">Admin Console</h1>
          <p className="text-sm text-muted-foreground">Provision users, seed fixtures, post results.</p>
        </div>
      </header>

      <UsersSection qc={qc} />
      <FixturesSection qc={qc} />
      <ResultsSection qc={qc} />
    </div>
  );
}

function UsersSection({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("football_profiles")
        .select("id, username, full_name, is_active")
        .order("username");
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const { data: adminIds = new Set<string>() } = useQuery({
    queryKey: ["admin-role-ids"],
    queryFn: async () => {
      const { data } = await supabase.from("football_user_roles").select("user_id, role").eq("role", "admin");
      return new Set<string>(((data ?? []) as { user_id: string }[]).map((r) => r.user_id));
    },
  });

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setCreating(true);
    try {
      // Use a separate client without session persistence so we don't sign out the admin
      const tmp = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await tmp.auth.signUp({
        email,
        password,
        options: { data: { username: username || email.split("@")[0] } },
      });
      if (error) { toast.error(error.message); return; }
      toast.success("User provisioned");
      setEmail(""); setPassword(""); setUsername("");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (u: ProfileRow) => {
    const { error } = await supabase
      .from("football_profiles")
      .update({ is_active: !u.is_active })
      .eq("id", u.id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const toggleAdmin = async (uid: string, on: boolean) => {
    if (on) {
      const { error } = await supabase.from("football_user_roles").insert({ user_id: uid, role: "admin" });
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("football_user_roles").delete().eq("user_id", uid).eq("role", "admin");
      if (error) { toast.error(error.message); return; }
    }
    qc.invalidateQueries({ queryKey: ["admin-role-ids"] });
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <UserCog className="h-5 w-5 text-primary" />
        <h2 className="font-display text-2xl">Users</h2>
      </div>

      <form onSubmit={createUser} className="mb-6 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" type="email" className="rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="text" className="rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username (optional)" className="rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
        <button disabled={creating} className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left">Username</th>
              <th className="px-3 py-2 text-left">Full name</th>
              <th className="px-3 py-2 text-center">Active</th>
              <th className="px-3 py-2 text-center">Admin</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border/50">
                <td className="px-3 py-2 font-medium">{u.username}</td>
                <td className="px-3 py-2 text-muted-foreground">{u.full_name ?? "—"}</td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => toggleActive(u)} className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${u.is_active ? "bg-primary/15 text-primary" : "bg-accent/20 text-accent"}`}>
                    {u.is_active ? "Active" : "Off"}
                  </button>
                </td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => toggleAdmin(u.id, !adminIds.has(u.id))} className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${adminIds.has(u.id) ? "bg-gold/20 text-gold" : "bg-muted text-muted-foreground"}`}>
                    {adminIds.has(u.id) ? "Admin" : "User"}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground">No users yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FixturesSection({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const [seeding, setSeeding] = useState(false);
  const [progress, setProgress] = useState(0);

  const seedFromJson = async () => {
    if (!confirm(`Seed ${worldCup.matches.length} matches from the World Cup 2026 schedule?`)) return;
    setSeeding(true);
    setProgress(0);
    try {
      const rows = worldCup.matches.map((m) => ({
        team_a: m.team1,
        team_b: m.team2,
        group_name: m.group ?? null,
        stage: detectStage(m.round),
        kickoff_at: parseKickoff(m.date, m.time),
        city: m.ground ?? null,
        stadium: m.ground ?? null,
        status: "scheduled" as MatchStatus,
      }));
      // chunked insert
      const chunk = 25;
      for (let i = 0; i < rows.length; i += chunk) {
        const slice = rows.slice(i, i + chunk);
        const { error } = await supabase.from("football_matches").insert(slice);
        if (error) throw error;
        setProgress(Math.min(rows.length, i + chunk));
      }
      toast.success(`Seeded ${rows.length} matches`);
      qc.invalidateQueries({ queryKey: ["all-matches"] });
      qc.invalidateQueries({ queryKey: ["dashboard-matches"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSeeding(false);
    }
  };

  const [form, setForm] = useState({
    team_a: "", team_b: "", group_name: "", stage: "group" as MatchStage,
    kickoff_at: "", stadium: "", city: "",
  });
  const addOne = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("football_matches").insert({
      ...form,
      group_name: form.group_name || null,
      stadium: form.stadium || null,
      city: form.city || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Match added");
      setForm({ team_a: "", team_b: "", group_name: "", stage: "group", kickoff_at: "", stadium: "", city: "" });
      qc.invalidateQueries({ queryKey: ["all-matches"] });
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl">Fixtures</h2>
        </div>
        <button onClick={seedFromJson} disabled={seeding} className="flex items-center gap-2 rounded-lg bg-gold/15 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/25">
          {seeding ? <><Loader2 className="h-3 w-3 animate-spin" /> Seeding {progress}/{worldCup.matches.length}</> : `Seed ${worldCup.matches.length} from JSON`}
        </button>
      </div>

      <form onSubmit={addOne} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input required value={form.team_a} onChange={(e) => setForm({ ...form, team_a: e.target.value })} placeholder="Team A" className="rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
        <input required value={form.team_b} onChange={(e) => setForm({ ...form, team_b: e.target.value })} placeholder="Team B" className="rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
        <input value={form.group_name} onChange={(e) => setForm({ ...form, group_name: e.target.value })} placeholder="Group A" className="rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
        <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as MatchStage })} className="rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary">
          {["group","round_of_32","round_of_16","quarter_final","semi_final","third_place","final"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input required type="datetime-local" value={form.kickoff_at} onChange={(e) => setForm({ ...form, kickoff_at: e.target.value })} className="rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
        <input value={form.stadium} onChange={(e) => setForm({ ...form, stadium: e.target.value })} placeholder="Stadium" className="rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
        <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" className="rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110">Add match</button>
      </form>
    </section>
  );
}

function ResultsSection({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const [edited, setEdited] = useState<Record<string, { score_a?: number | null; score_b?: number | null; pen_a?: number | null; pen_b?: number | null; status?: MatchStatus }>>({});

  const { data: matches = [] } = useQuery({
    queryKey: ["admin-matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("football_matches")
        .select("*")
        .order("kickoff_at");
      if (error) throw error;
      return (data ?? []) as Match[];
    },
  });

  useEffect(() => { setEdited({}); }, [matches.length]);

  const setField = (id: string, patch: Record<string, unknown>) =>
    setEdited((e) => ({ ...e, [id]: { ...e[id], ...patch } }));

  const save = async (m: Match) => {
    const patch = edited[m.id];
    if (!patch) return;
    const merged = {
      score_a: patch.score_a ?? m.score_a,
      score_b: patch.score_b ?? m.score_b,
      pen_a: patch.pen_a ?? m.pen_a,
      pen_b: patch.pen_b ?? m.pen_b,
      status: patch.status ?? m.status,
    };
    const { error } = await supabase.from("football_matches").update(merged).eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    if (merged.status === "finished") {
      const { error: rpcErr } = await supabase.rpc("football_recalculate_match_points", { _match_id: m.id });
      if (rpcErr) toast.warning(`Saved, but recalc failed: ${rpcErr.message}`);
      else toast.success("Saved & recalculated");
    } else {
      toast.success("Saved");
    }
    qc.invalidateQueries({ queryKey: ["admin-matches"] });
    qc.invalidateQueries({ queryKey: ["all-matches"] });
    qc.invalidateQueries({ queryKey: ["leaderboard"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this match?")) return;
    const { error } = await supabase.from("football_matches").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["admin-matches"] });
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <Save className="h-5 w-5 text-primary" />
        <h2 className="font-display text-2xl">Results</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-2 py-2 text-left">Match</th>
              <th className="px-2 py-2">Score A</th>
              <th className="px-2 py-2">Score B</th>
              <th className="px-2 py-2">Pen A</th>
              <th className="px-2 py-2">Pen B</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => {
              const e = edited[m.id] ?? {};
              return (
                <tr key={m.id} className="border-b border-border/40">
                  <td className="px-2 py-1.5">
                    <div className="font-medium">{m.team_a} vs {m.team_b}</div>
                    <div className="text-[10px] text-muted-foreground">{new Date(m.kickoff_at).toLocaleString()} · {m.stage}</div>
                  </td>
                  <td className="px-2 py-1.5"><Num value={e.score_a ?? m.score_a} onChange={(v) => setField(m.id, { score_a: v })} /></td>
                  <td className="px-2 py-1.5"><Num value={e.score_b ?? m.score_b} onChange={(v) => setField(m.id, { score_b: v })} /></td>
                  <td className="px-2 py-1.5"><Num value={e.pen_a ?? m.pen_a} onChange={(v) => setField(m.id, { pen_a: v })} /></td>
                  <td className="px-2 py-1.5"><Num value={e.pen_b ?? m.pen_b} onChange={(v) => setField(m.id, { pen_b: v })} /></td>
                  <td className="px-2 py-1.5">
                    <select
                      value={(e.status ?? m.status)}
                      onChange={(ev) => setField(m.id, { status: ev.target.value as MatchStatus })}
                      className="rounded-md border border-border bg-input px-1.5 py-1 text-xs"
                    >
                      <option value="scheduled">scheduled</option>
                      <option value="live">live</option>
                      <option value="finished">finished</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1">
                      <button onClick={() => save(m)} className="rounded-md bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground hover:brightness-110">Save</button>
                      <button onClick={() => remove(m.id)} className="rounded-md bg-accent/15 p-1.5 text-accent hover:bg-accent/30"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {matches.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No matches. Seed from JSON above.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Num({ value, onChange }: { value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <input
      type="number"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      className="w-14 rounded-md border border-border bg-input px-1.5 py-1 text-center text-xs outline-none focus:border-primary"
    />
  );
}
