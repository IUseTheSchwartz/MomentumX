import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { formatDate } from '../../lib/utils';

export default function SupportAdmin() {
  const [profile, setProfile] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [messagesByTicket, setMessagesByTicket] = useState({});
  const [readsByTicket, setReadsByTicket] = useState({});
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [search, setSearch] = useState('');

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
        .select('*, profiles!support_tickets_agent_id_fkey(id, display_name, email)')
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

    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from('support_message_reads')
      .upsert(
        {
          ticket_id: ticketId,
          user_id: session.user.id,
          last_read_at: nowIso
        },
        { onConflict: 'ticket_id,user_id' }
      );

    if (!error) {
      setReadsByTicket((prev) => ({
        ...prev,
        [ticketId]: {
          ticket_id: ticketId,
          user_id: session.user.id,
          last_read_at: nowIso
        }
      }));
    }
  }

  async function openTicket(ticketId) {
    setSelectedTicketId(ticketId);
    await markSelectedTicketRead(ticketId);
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

  async function toggleTicketStatus(ticket, nextStatus) {
    setStatusMessage('');

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        setStatusMessage('No session found.');
        return;
      }

      const patch =
        nextStatus === 'closed'
          ? {
              status: 'closed',
              closed_at: new Date().toISOString(),
              closed_by: session.user.id
            }
          : {
              status: 'open',
              closed_at: null,
              closed_by: null
            };

      const { error } = await supabase
        .from('support_tickets')
        .update(patch)
        .eq('id', ticket.id);

      if (error) throw error;

      await load();
    } catch (error) {
      console.error('Failed to update support ticket:', error);
      setStatusMessage(error.message || 'Failed to update ticket.');
    }
  }

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;

      const text = [
        ticket.subject,
        ticket.profiles?.display_name,
        ticket.profiles?.email
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return text.includes(search.toLowerCase());
    });
  }, [tickets, statusFilter, search]);

  const selectedTicket = useMemo(
    () => filteredTickets.find((ticket) => ticket.id === selectedTicketId) || tickets.find((ticket) => ticket.id === selectedTicketId) || null,
    [filteredTickets, tickets, selectedTicketId]
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
          <p>View all support tickets and reply to agents.</p>
        </div>
      </div>

      {statusMessage ? (
        <div className="glass" style={{ padding: 12, marginBottom: 12, flexShrink: 0 }}>
          {statusMessage}
        </div>
      ) : null}

      <div
        className="glass"
        style={{
          padding: 12,
          marginBottom: 12,
          flexShrink: 0
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 10
          }}
        >
          <label>
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Subject, agent name, or email..."
            />
          </label>

          <label>
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: '360px minmax(0, 1fr)',
          gap: 12
        }}
      >
        <div
          style={{
            minHeight: 0,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}
        >
          {!filteredTickets.length ? (
            <div className="glass" style={{ padding: 16 }}>
              No support tickets found.
            </div>
          ) : (
            filteredTickets.map((ticket) => {
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
                    {ticket.profiles?.display_name || ticket.profiles?.email || 'Agent'}
                  </div>

                  <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
                    {ticket.status} · Updated {formatDate(ticket.updated_at)}
                  </div>
                </button>
              );
            })
          )}
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
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'flex-start',
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{selectedTicket.subject}</div>
                  <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
                    {selectedTicket.profiles?.display_name || selectedTicket.profiles?.email || 'Agent'} · {selectedTicket.status}
                  </div>
                </div>

                {selectedTicket.status === 'open' ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => toggleTicketStatus(selectedTicket, 'closed')}
                  >
                    Close Ticket
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => toggleTicketStatus(selectedTicket, 'open')}
                  >
                    Reopen Ticket
                  </button>
                )}
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
                      (isMine ? 'You' : 'Agent');

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
