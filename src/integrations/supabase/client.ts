import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gzampnmelaeqhwzzsvam.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6YW1wbm1lbGFlcWh3enpzdmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc3NTMyNjcsImV4cCI6MjA2MzMyOTI2N30.x5KnK9mtIDf-ZNiGKSGlRqwjP57WMZ0Jx_ZdWWk3--8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

export type MatchStage =
  | "group"
  | "round_of_32"
  | "round_of_16"
  | "quarter_final"
  | "semi_final"
  | "third_place"
  | "final";
export type MatchStatus = "scheduled" | "live" | "finished" | "cancelled";
export type PredictionPick = "team_a" | "team_b" | "draw";

export interface Match {
  id: string;
  team_a: string;
  team_b: string;
  team_a_flag: string | null;
  team_b_flag: string | null;
  group_name: string | null;
  stage: MatchStage;
  kickoff_at: string;
  stadium: string | null;
  city: string | null;
  status: MatchStatus;
  score_a: number | null;
  score_b: number | null;
  pen_a: number | null;
  pen_b: number | null;
}

export interface Prediction {
  id: string;
  user_id: string;
  match_id: string;
  pick: PredictionPick;
  score_a: number | null;
  score_b: number | null;
  pen_winner: "team_a" | "team_b" | null;
  points_awarded: number;
}

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  is_active: boolean;
}

export interface Room {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  points_outcome: number;
  points_exact_bonus: number;
  points_goal_diff_bonus: number;
  knockout_multiplier: number;
  created_at: string;
}
