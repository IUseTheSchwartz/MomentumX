import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

let sessionRequest = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getSessionSafe() {
  if (!sessionRequest) {
    sessionRequest = supabase.auth
      .getSession()
      .catch((error) => {
        const text = String(error?.message || error || '').toLowerCase();

        if (
          text.includes('lock') ||
          text.includes('was released because another request stole it')
        ) {
          return { data: { session: null }, error: null };
        }

        throw error;
      })
      .finally(() => {
        sessionRequest = null;
      });
  }

  return sessionRequest;
}

export async function waitForSessionSafe({
  timeoutMs = 6000,
  intervalMs = 250
} = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const {
      data: { session }
    } = await getSessionSafe();

    if (session) return session;
    await sleep(intervalMs);
  }

  return null;
}
