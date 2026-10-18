import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
);

export const passwordRecoveryStorageKey = "ethiodev:password-recovery-user";

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null;

if (isSupabaseConfigured && typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session?.user?.id) {
      window.sessionStorage.setItem(
        passwordRecoveryStorageKey,
        session.user.id,
      );
    } else if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
      window.sessionStorage.removeItem(passwordRecoveryStorageKey);
    }
  });
}
