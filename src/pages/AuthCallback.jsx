import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Verifying access...');

  useEffect(() => {
    let active = true;

    async function getSessionWithRetry() {
      for (let i = 0; i < 10; i += 1) {
        const {
          data: { session }
        } = await supabase.auth.getSession();

        if (session) return session;

        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      return null;
    }

    async function run() {
      const session = await getSessionWithRetry();

      if (!session) {
        if (active) {
          setMessage('No session found. Sending you back...');
          setTimeout(() => navigate('/', { replace: true }), 800);
        }
        return;
      }

      const providerToken = session.provider_token;

      if (!providerToken) {
        await supabase.auth.signOut();
        navigate('/denied', { replace: true });
        return;
      }

      const response = await fetch('/.netlify/functions/discord-membership-check', {
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

      const data = await response.json();

      if (!active) return;

      if (!response.ok || !data.ok) {
        await supabase.auth.signOut();
        navigate('/denied', { replace: true });
        return;
      }

      if (data.banned) {
        navigate('/ineligible', { replace: true });
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
