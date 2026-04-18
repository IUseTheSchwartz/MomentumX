import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { formatDate } from '../../lib/utils';

export default function Support() {
  const [profile, setProfile] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [messagesByTicket, setMessagesByTicket] = useState({});
  const [readsByTicket, setReadsByTicket] = useState({});
  const [selectedTicketId, setSelectedTicketId] = useState(null);

  const [subject, setSubject] = useState('');
  const [openingMessage, setOpeningMessage] = useState('');
  const [replyDraft, setReplyDraft] = useState('');

  const [creatingTicket, setCreatingTicket] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedTicketId && tickets.length) {
      setSelectedTicketId(tickets[0].id);
    }
  }, [tickets, selectedTicketId]);

  async function load() {
    setStatusMessage('');

    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) return;

    const [{ data: profileRow }, { data: ticketRows }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
      supabase
        .from('support_tickets')
        .select('*')
        .eq('agent_id', session.user.id)
        .order('updated_at', { ascending: false })
    ]);

    const safeTickets = ticketRows || [];

    setProfile(profileRow || null);
    setTickets(safeTickets);

    if (!safeTickets.length) {
      setMessagesByTicket({});
      setReadsByTicket({});
      return;
    }

    const ticketIds = safeTickets.map((ticket) => ticket.id);

    const [{ data: messageRows }, { data: readRows }] = await Promise.all([
      supabase
        .from('support_messages')
        .select('*, profiles!support_messages_sender_id_fkey(id, display_name, email, is_admin)')
        .in('ticket_id', ticketIds)
        .order('created_at', { ascending: true }),
      supabase
        .from('support_message_reads')
        .select('*')
        .eq('user_id', session.user.id)
        .in('ticket_id', ticketIds)
    ]);

    const nextMessagesByTicket = {};
    for (const ticket of safeTickets) {
      nextMessagesByTicket[ticket.id] = [];
    }

    for (const row of messageRows || []) {
      if (!nextMessagesByTicket[row.ticket_id]) {
        nextMessagesByTicket[row.ticket_id] = [];
      }
      nextMessagesByTicket[row.ticket_id].push(row);
    }

    const nextReadsByTicket = {};
    for (const row of readRows || []) {
      nextReadsByTicket[row.ticket_id] = row;
    }

    setMessagesByTicket(nextMessagesByTicket);
    setReadsByTicket(nextReadsByTicket);
  }

  async function markSelectedTicketRead(ticketId) {
    if (!ticketId) return;

    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) return;

    const { error } = await supabase
      .from('support_message_reads')
      .upsert(
        {
          ticket_id: ticketId,
          user_id: session.user.id,
          last_read_at: new Date().toISOString()
        },
        { onConflict: 'ticket_id,user_id' }
      );

    if (!error) {
      setReadsByTicket((prev) => ({
        ...prev,
        [ticketId]: {
          ticket_id: ticketId,
          user_id: session.user.id,
          last_read_at: new Date().toISOString()
        }
      }));
    }
  }

  async function openTicket(ticketId) {
    setSelectedTicketId(ticketId);
    await markSelectedTicketRead(ticketId);
  }

  async function createTicket(e) {
    e.preventDefault();
    setStatusMessage('');

    const trimmedSubject = subject.trim();
    const trimmedOpeningMessage = openingMessage.trim();

    if (!trimmedSubject || !trimmedOpeningMessage) {
      setStatusMessage('Add a subject and message first.');
      return;
    }

    setCreatingTicket(true);

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        setStatusMessage('No session found.');
        return;
      }

      const { data: insertedTicket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          agent_id: session.user.id,
          subject: trimmedSubject,
          status: 'open'
        })
        .select('*')
        .single();

      if (ticketError) throw ticketError;

      const { error: messageError } = await supabase.from('support_messages').insert({
        ticket_id: insertedTicket.id,
        sender_id: session.user.id,
        body: trimmedOpeningMessage
      });

      if (messageError) throw messageError;

      setSubject('');
      setOpeningMessage('');
      setReplyDraft('');
      setStatusMessage('Support ticket created.');
      await load();
      setSelectedTicketId(insertedTicket.id);
      await markSelectedTicketRead(insertedTicket.id);
    } catch (error) {
      console.error('Failed to create support ticket:', error);
      setStatusMessage(error.message || 'Failed to create support ticket.');
    } finally {
      setCreatingTicket(false);
    }
  }

  async function sendReply(e) {
    e.preventDefault();
    setStatusMessage('');

    const trimmedReply = replyDraft.trim();

    if (!selectedTicketId || !trimmedReply) {
      setStatusMessage('Add a message first.');
      return;
    }

    setSendingReply(true);

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        setStatusMessage('No session found.');
        return;
      }

      const { error } = await supabase.from('support_messages').insert({
        ticket_id: selectedTicketId,
        sender_id: session.user.id,
        body: trimmedReply
      });

      if (error) throw error;

      setReplyDraft('');
      await markSelectedTicketRead(selectedTicketId);
      await load();
    } catch (error) {
      console.error('Failed to send support reply:', error);
      setStatusMessage(error.message || 'Failed to send message.');
    } finally {
      setSendingReply(false);
    }
  }

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) || null,
    [tickets, selectedTicketId]
  );

  const selectedMessages = useMemo(
    () => messagesByTicket[selectedTicketId] || [],
    [messagesByTicket, selectedTicketId]
  );

  function getUnreadCount(ticketId) {
    const messages = messagesByTicket[ticketId] || [];
    const readAt = readsByTicket[ticketId]?.last_read_at
      ? new Date(readsByTicket[ticketId].last_read_at).getTime()
      : 0;

    return messages.filter((message) => {
      const createdAt = new Date(message.created_at).getTime();
      return createdAt > readAt && message.sender_id !== profile?.id;
    }).length;
  }

  return (
    <div
      className="page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden'
      }}
    >
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <h1>Support</h1>
          <p>Create support tickets and chat with admins inside the app.</p>
        </div>
      </div>

      {statusMessage ? (
        <div className="glass" style={{ padding: 12, marginBottom: 12, flexShrink: 0 }}>
          {statusMessage}
        </div>
      ) : null}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: '340px minmax(0, 1fr)',
          gap: 12
        }}
      >
        <div
          style={{
            minHeight: 0,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}
        >
          <div className="glass" style={{ padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>New Ticket</h2>

            <form onSubmit={createTicket}>
              <label>
                Subject
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="What do you need help with?"
                />
              </label>

              <label className="top-gap">
                Message
                <textarea
                  value={openingMessage}
                  onChange={(e) => setOpeningMessage(e.target.value)}
                  placeholder="Explain the issue..."
                  rows={6}
                />
              </label>

              <div className="top-gap">
                <button className="btn btn-primary" type="submit" disabled={creatingTicket}>
                  {creatingTicket ? 'Creating...' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>

          <div className="glass" style={{ padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Your Tickets</h2>

            {!tickets.length ? (
              <div style={{ opacity: 0.75 }}>No support tickets yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tickets.map((ticket) => {
                  const unreadCount = getUnreadCount(ticket.id);
                  const isActive = ticket.id === selectedTicketId;

                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => openTicket(ticket.id)}
                      className="glass"
                      style={{
                        textAlign: 'left',
                        padding: 12,
                        border: isActive
                          ? '1px solid rgba(17,217,140,0.45)'
                          : '1px solid rgba(255,255,255,0.08)',
                        background: isActive
                          ? 'rgba(17,217,140,0.08)'
                          : undefined,
                        cursor: 'pointer'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 10,
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{ticket.subject}</div>
                        {unreadCount > 0 ? (
                          <div
                            style={{
                              minWidth: 24,
                              height: 24,
                              padding: '0 8px',
                              borderRadius: 999,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              fontWeight: 800,
                              background: 'rgba(17,217,140,0.18)',
                              border: '1px solid rgba(17,217,140,0.3)',
                              color: '#34d399'
                            }}
                          >
                            {unreadCount}
                          </div>
                        ) : null}
                      </div>

                      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
                        {ticket.status} · Updated {formatDate(ticket.updated_at)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div
          className="glass"
          style={{
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            padding: 16
          }}
        >
          {!selectedTicket ? (
            <div style={{ opacity: 0.75 }}>Select a ticket to view the conversation.</div>
          ) : (
            <>
              <div
                style={{
                  paddingBottom: 12,
                  marginBottom: 12,
                  borderBottom: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 800 }}>{selectedTicket.subject}</div>
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
                  {selectedTicket.status} · Created {formatDate(selectedTicket.created_at)}
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflow: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  paddingRight: 4
                }}
              >
                {!selectedMessages.length ? (
                  <div style={{ opacity: 0.75 }}>No messages yet.</div>
                ) : (
                  selectedMessages.map((message) => {
                    const isMine = message.sender_id === profile?.id;
                    const senderName =
                      message.profiles?.display_name ||
                      message.profiles?.email ||
                      (isMine ? 'You' : 'Admin');

                    return (
                      <div
                        key={message.id}
                        style={{
                          alignSelf: isMine ? 'flex-end' : 'flex-start',
                          maxWidth: '78%',
                          padding: 12,
                          borderRadius: 16,
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: isMine
                            ? 'rgba(17,217,140,0.10)'
                            : 'rgba(255,255,255,0.03)'
                        }}
                      >
                        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
                          {senderName}
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{message.body}</div>
                        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
                          {formatDate(message.created_at)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {selectedTicket.status === 'closed' ? (
                <div className="top-gap" style={{ opacity: 0.75 }}>
                  This support ticket is closed.
                </div>
              ) : (
                <form onSubmit={sendReply} className="top-gap">
                  <label>
                    Reply
                    <textarea
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder="Type your message..."
                      rows={4}
                    />
                  </label>

                  <div className="top-gap">
                    <button className="btn btn-primary" type="submit" disabled={sendingReply}>
                      {sendingReply ? 'Sending...' : 'Send Message'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
