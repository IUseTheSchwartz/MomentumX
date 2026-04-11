import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForStableSession() {
  const first = await supabase.auth.getSession();
  if (first.data.session) return first.data.session;

  return new Promise((resolve) => {
    let resolved = false;

    const finish = (session) => {
      if (resolved) return;
      resolved = true;
      subscription?.unsubscribe();
      clearTimeout(timeoutId);
      resolve(session || null);
    };

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session &&
        (event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'INITIAL_SESSION')
      ) {
        finish(session);
      }

      if (!session && event === 'INITIAL_SESSION') {
        finish(null);
      }
    });

    const timeoutId = setTimeout(async () => {
      const retry = await supabase.auth.getSession();
      finish(retry.data.session || null);
    }, 2500);
  });
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Verifying access...');

  useEffect(() => {
    let active = true;

    async function run() {
      const session = await waitForStableSession();

      if (!active) return;

      if (!session) {
        setMessage('Session not found. Sending you back...');
        setTimeout(() => {
          if (active) navigate('/', { replace: true });
        }, 800);
        return;
      }

      const providerToken = session.provider_token;

      if (!providerToken) {
        await supabase.auth.signOut();
        if (active) navigate('/denied', { replace: true });
        return;
      }

      setMessage('Checking membership...');

      let response;
      let data;

      try {
        response = await fetch('/.netlify/functions/discord-membership-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerToken,
            userId: session.user.id,
            email: session.user.email,
            fullName:
              session.user.user_metadata?.full_name ||
              session.user.user_metadata?.name ||
              session.user.email ||
              'Momentum Agent',
            avatarUrl: session.user.user_metadata?.avatar_url || null,
            discordId: session.user.user_metadata?.provider_id || null,
            discordUsername:
              session.user.user_metadata?.preferred_username ||
              session.user.user_metadata?.full_name ||
              session.user.email
          })
        });

        data = await response.json();
      } catch {
        data = null;
      }

      if (!active) return;

      if (!response?.ok || !data?.ok) {
        await supabase.auth.signOut();
        navigate('/denied', { replace: true });
        return;
      }

      if (data.banned) {
        navigate('/ineligible', { replace: true });
        return;
      }

      await delay(150);

      const {
        data: { session: refreshedSession }
      } = await supabase.auth.getSession();

      if (!active) return;

      if (!refreshedSession) {
        setMessage('Session not found. Sending you back...');
        setTimeout(() => {
          if (active) navigate('/', { replace: true });
        }, 800);
        return;
      }

      if (data.isAdmin) {
        navigate('/admin/overview', { replace: true });
        return;
      }

      navigate('/app/dashboard', { replace: true });
    }

    run();

    return () => {
      active = false;
    };
  }, [navigate]);

  return <div className="page-center">{message}</div>;
}
