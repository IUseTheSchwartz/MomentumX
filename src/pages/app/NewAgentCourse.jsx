import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const videos = [
  'Intro Video',
  'Why Most People Fail',
  'Why Anyone Can Do It',
  'Day to Day as an Agent',
  'What is an IUL',
  'How Agents Get Paid',
  'Paid Leads',
  'Lead Spend & Profit',
  'Cameras Requirement',
  'Chargebacks'
];

export default function NewAgentCourse() {
  const [status, setStatus] = useState(null);
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState('');

  async function load() {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    const { data: courseData } = await supabase
      .from('agent_course_status')
      .select('*')
      .eq('agent_id', session.user.id)
      .maybeSingle();

    setProfile(profileData);
    setStatus(courseData || { current_step: 0, status: 'not_started' });
  }

  useEffect(() => {
    load();
  }, []);

  async function nextStep() {
    const next = (status.current_step || 0) + 1;

    await supabase.from('agent_course_status').upsert({
      agent_id: profile.id,
      current_step: next,
      status: 'in_progress'
    });

    load();
  }

  async function submitForReview() {
    await supabase.from('agent_course_status').upsert({
      agent_id: profile.id,
      status: 'pending_review',
      submitted_at: new Date().toISOString()
    });

    setMessage('Submitted for review.');
    load();
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>New Agent Course</h1>
        <p>Complete all steps to unlock Momentum X</p>
      </div>

      {status?.status === 'pending_review' && (
        <div className="glass">Pending admin review</div>
      )}

      {status?.status === 'returned' && (
        <div className="glass">
          Returned: {status.returned_note || 'Fix and resubmit'}
        </div>
      )}

      <div className="glass" style={{ padding: 16 }}>
        {videos.map((title, i) => {
          const unlocked = i <= status.current_step;

          return (
            <div key={i} style={{ marginBottom: 10 }}>
              <strong>{title}</strong>

              {unlocked ? (
                <button
                  className="btn btn-primary btn-small"
                  onClick={nextStep}
                >
                  Complete
                </button>
              ) : (
                <span> Locked</span>
              )}
            </div>
          );
        })}
      </div>

      {status?.current_step >= videos.length && (
        <div className="glass top-gap">
          <h3>Final Voice Recording</h3>
          <button className="btn btn-primary" onClick={submitForReview}>
            Submit for Review
          </button>
        </div>
      )}

      {message && <div className="top-gap">{message}</div>}
    </div>
  );
}
