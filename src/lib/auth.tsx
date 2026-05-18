import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, type Profile } from "@/integrations/supabase/client";

interface AuthState {
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const [{ data: p }, { data: roles }] = await Promise.all([
      supabase.from("football_profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("football_user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile((p as Profile) ?? null);
    setIsAdmin(!!roles?.some((r: { role: string }) => r.role === "admin"));
  };

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    const s = data.session;
    if (s?.user) {
      setUserId(s.user.id);
      setEmail(s.user.email ?? null);
      await loadProfile(s.user.id);
    } else {
      setUserId(null);
      setEmail(null);
      setProfile(null);
      setIsAdmin(false);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        setEmail(session.user.email ?? null);
        // Defer to avoid deadlock
        setTimeout(() => loadProfile(session.user.id), 0);
      } else {
        setUserId(null);
        setEmail(null);
        setProfile(null);
        setIsAdmin(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthCtx.Provider value={{ userId, email, profile, isAdmin, loading, signOut, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
