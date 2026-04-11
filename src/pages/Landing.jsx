import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import Starfield from '../components/Starfield';

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (mounted && session) {
        navigate('/auth/callback', { replace: true });
      }
    }

    bootstrap();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted && session) {
        navigate('/auth/callback', { replace: true });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  async function loginWithDiscord() {
    const redirectTo = `${window.location.origin}/auth/callback`;

    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo,
        scopes: 'identify guilds'
      }
    });
  }

  return (
    <div className="landing">
      <Starfield />

      <div className="landing-inner">
        <div className="hero glass">
          <div className="eyebrow">Momentum Financial</div>
          <h1>Momentum X</h1>
          <p className="hero-copy">
            Lead distribution. KPI pressure. Tier control. Agent ops with a futuristic command-center feel.
          </p>

          <div className="hero-actions">
            <button className="btn btn-primary" onClick={loginWithDiscord}>
              Login with Discord
            </button>
          </div>

          <div className="hero-foot">
            Must be a member of the Momentum Financial Discord server.
          </div>
        </div>
      </div>
    </div>
  );
}
