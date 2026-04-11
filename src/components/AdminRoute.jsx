import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AdminRoute({ children }) {
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [profileResolved, setProfileResolved] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadProfile(nextSession) {
      if (!mounted) return;

      if (!nextSession) {
        setProfile(null);
        setProfileLoading(false);
        setProfileResolved(true);
        return;
      }

      setProfileLoading(true);
      setProfileResolved(false);

      const timeout = new Promise((resolve) => {
        setTimeout(() => resolve({ timedOut: true }), 6000);
      });

      const profileRequest = supabase
        .from('profiles')
        .select('*')
        .eq('id', nextSession.user.id)
        .maybeSingle();

      const result = await Promise.race([profileRequest, timeout]);

      if (!mounted) return;

      if (result?.timedOut) {
        setProfile(null);
        setProfileLoading(false);
        setProfileResolved(true);
        return;
      }

      const { data, error } = result;

      if (error) {
        setProfile(null);
      } else {
        setProfile(data || null);
      }

      setProfileLoading(false);
      setProfileResolved(true);
    }

    async function init() {
      const {
        data: { session: initialSession }
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(initialSession ?? null);
      setAuthLoading(false);
      await loadProfile(initialSession ?? null);
    }

    init();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession ?? null);
      setAuthLoading(false);
      await loadProfile(nextSession ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (authLoading || session === undefined) {
    return <div className="page-center">Loading Admin...</div>;
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (profileLoading || !profileResolved) {
    return <div className="page-center">Loading Admin...</div>;
  }

  if (!profile?.is_admin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  if (profile?.lead_access_banned) {
    return <Navigate to="/ineligible" replace />;
  }

  return children;
}
