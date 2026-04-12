// src/pages/AuthCallback.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getOAuthErrorDetails() {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));

  const error =
    search.get('error') ||
    hash.get('error') ||
    null;

  const errorCode =
    search.get('error_code') ||
    hash.get('error_code') ||
    null;

  const errorDescription =
    search.get('error_description') ||
    hash.get('error_description') ||
    null;

  return { error, errorCode, errorDescription };
}

function getFriendlyOAuthMessage(errorCode, errorDescription) {
  const text = `${errorCode || ''} ${errorDescription || ''}`.toLowerCase();

  if (text.includes('over_email_send_rate_limit')) {
    return 'Too many login attempts right now. Please wait a minute and try again.';
  }

  if (text.includes('error getting user email from external provider')) {
    return 'Discord login could not return account email. Please try again.';
  }

  if (text.includes('unexpected_failure')) {
    return 'Discord login failed unexpectedly. Please try again.';
  }

  return 'Login failed. Please try again.';
}

async function exchangeSessionFromUrlIfNeeded() {
  const search = new URLSearchParams(window.location.search);
  const code = search.get('code');

  if (!code) return null;

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return null;

  return data.session || null;
}

async function waitForStableSession({ timeoutMs = 5000, intervalMs = 250 } = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (session) return session;

    await delay(intervalMs);
  }

  return null;
}

async function waitForProviderToken({ timeoutMs = 3000, intervalMs = 200 } = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (session?.provider_token) return session;

    await delay(intervalMs);
  }

  return null;
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Verifying access...');

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        const { error, errorCode, errorDescription } = getOAuthErrorDetails();

        if (error) {
          console.error('[AuthCallback] OAuth redirect error', {
            error,
            errorCode,
            errorDescription,
            href: window.location.href
          });

          setMessage(getFriendlyOAuthMessage(errorCode, errorDescription));

          setTimeout(() => {
            if (active) navigate('/', { replace: true });
          }, 1800);

          return;
        }

        setMessage('Completing login...');

        await exchangeSessionFromUrlIfNeeded();

        if (!active) return;

        let session = await waitForStableSession();

        if (!active) return;

        if (!session) {
          setMessage('Session not found. Sending you back...');
          setTimeout(() => {
            if (active) navigate('/', { replace: true });
          }, 1000);
          return;
        }

        if (!session.provider_token) {
          setMessage('Finalizing Discord access...');
          const tokenReadySession = await waitForProviderToken();
          if (tokenReadySession) {
            session = tokenReadySession;
          }
        }

        if (!active) return;

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

        const {
          data: { session: refreshedSession }
        } = await supabase.auth.getSession();

        if (!active) return;

        if (!refreshedSession) {
          setMessage('Session not found. Sending you back...');
          setTimeout(() => {
            if (active) navigate('/', { replace: true });
          }, 1000);
          return;
        }

        if (data.isAdmin) {
          navigate('/admin/overview', { replace: true });
          return;
        }

        navigate('/app/dashboard', { replace: true });
      } catch (error) {
        console.error('[AuthCallback] unhandled error', error);

        setMessage('Login failed. Sending you back...');
        setTimeout(() => {
          if (active) navigate('/', { replace: true });
        }, 1000);
      }
    }

    run();

    return () => {
      active = false;
    };
  }, [navigate]);

  return <div className="page-center">{message}</div>;
}
