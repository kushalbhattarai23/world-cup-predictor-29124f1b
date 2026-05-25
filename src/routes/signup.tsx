import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Trophy, Loader2 } from "lucide-react";

const schema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "At least 3 characters")
    .max(24, "Max 24 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, underscore only"),
  fullName: z.string().trim().min(1, "Required").max(80),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
});
type FormVals = z.infer<typeof schema>;

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { userId, loading, refresh } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && userId) navigate({ to: "/" });
  }, [loading, userId, navigate]);

  const { register, handleSubmit, formState: { errors } } = useForm<FormVals>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (vals: FormVals) => {
    setSubmitting(true);
    try {
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/` : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: vals.email,
        password: vals.password,
        options: {
          emailRedirectTo: redirectTo,
          data: { username: vals.username, full_name: vals.fullName },
        },
      });
      if (error) throw error;

      const uid = data.user?.id;
      if (uid) {
        const { error: profileErr } = await supabase
          .from("football_profiles")
          .upsert(
            {
              id: uid,
              username: vals.username,
              full_name: vals.fullName,
              is_active: true,
            },
            { onConflict: "id" },
          );
        if (profileErr) {
          if (profileErr.code === "23505") {
            throw new Error("That username is already taken.");
          }
          throw profileErr;
        }
      }

      if (data.session) {
        await refresh();
        toast.success("Welcome to Pitch Predictor!");
        navigate({ to: "/" });
      } else {
        toast.success("Check your email to confirm your account.");
        navigate({ to: "/login" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign up failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/80 p-8 shadow-glow backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-primary/15 p-3">
            <Trophy className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-3xl tracking-wider">Join the League</h1>
            <p className="text-xs text-muted-foreground">World Cup 2026 · Free to play</p>
          </div>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Username
            </label>
            <input
              autoComplete="username"
              {...register("username")}
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            {errors.username && <p className="mt-1 text-xs text-accent">{errors.username.message}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Full name
            </label>
            <input
              autoComplete="name"
              {...register("fullName")}
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            {errors.fullName && <p className="mt-1 text-xs text-accent">{errors.fullName.message}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              {...register("email")}
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            {errors.email && <p className="mt-1 text-xs text-accent">{errors.email.message}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              {...register("password")}
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            {errors.password && <p className="mt-1 text-xs text-accent">{errors.password.message}</p>}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create account
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
