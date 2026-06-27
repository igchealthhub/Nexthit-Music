import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function MessagesPage() {
  const { user } = useAuth()
  const [allMessages, setAllMessages] = useState([])
  const [profiles, setProfiles] = useState({})
  const [conversations, setConversations] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [thread, setThread] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const threadRef = useRef(null)

  useEffect(() => { load() }, [user?.id])

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [thread])

  async function load() {
    setLoading(true)
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: true })
      .limit(500)

    const msgList = msgs || []
    setAllMessages(msgList)

    // Fetch profiles for all other users
    const otherIds = [...new Set(
      msgList.flatMap(m => [m.sender_id, m.recipient_id]).filter(id => id !== user.id)
    )]

    if (otherIds.length) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, verified')
        .in('id', otherIds)
      const pMap = {}
      profileData?.forEach(p => { pMap[p.id] = p })
      setProfiles(pMap)
      buildConversations(msgList, pMap)
    } else {
      buildConversations(msgList, {})
    }

    setLoading(false)
  }

  function buildConversations(msgs, profileMap) {
    const convMap = {}
    msgs.forEach(m => {
      const otherId = m.sender_id === user.id ? m.recipient_id : m.sender_id
      if (!convMap[otherId]) {
        convMap[otherId] = { userId: otherId, profile: profileMap[otherId], messages: [], unread: 0 }
      }
      convMap[otherId].messages.push(m)
      if (!m.read && m.recipient_id === user.id) convMap[otherId].unread++
    })
    const sorted = Object.values(convMap).sort((a, b) => {
      const aLast = a.messages[a.messages.length - 1]?.created_at || ''
      const bLast = b.messages[b.messages.length - 1]?.created_at || ''
      return bLast.localeCompare(aLast)
    })
    setConversations(sorted)
  }

  function selectConversation(conv) {
    setSelectedUserId(conv.userId)
    const msgs = allMessages
      .filter(m =>
        (m.sender_id === user.id && m.recipient_id === conv.userId) ||
        (m.sender_id === conv.userId && m.recipient_id === user.id)
      )
    setThread(msgs)
    markConvRead(conv.userId)
  }

  async function markConvRead(otherId) {
    await supabase.from('messages').update({ read: true })
      .eq('recipient_id', user.id)
      .eq('sender_id', otherId)
      .eq('read', false)
    setConversations(prev => prev.map(c => c.userId === otherId ? { ...c, unread: 0 } : c))
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!newMsg.trim() || !selectedUserId || sending) return
    setSending(true)
    const { data, error } = await supabase.from('messages').insert({
      sender_id: user.id,
      recipient_id: selectedUserId,
      body: newMsg.trim(),
    }).select('*').single()
    if (!error && data) {
      const updated = [...allMessages, data]
      setAllMessages(updated)
      setThread(prev => [...prev, data])
      const conv = conversations.find(c => c.userId === selectedUserId)
      if (conv) {
        buildConversations(updated, profiles)
      } else {
        // New conversation
        await load()
      }
      setNewMsg('')
    }
    setSending(false)
  }

  async function startNewConversation(profile) {
    const existing = conversations.find(c => c.userId === profile.id)
    if (existing) {
      selectConversation(existing)
    } else {
      const p = { ...profiles, [profile.id]: profile }
      setProfiles(p)
      setSelectedUserId(profile.id)
      setThread([])
    }
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
  }

  async function handleSearch(q) {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase.from('profiles')
      .select('id, display_name, avatar_url, verified, role')
      .ilike('display_name', `%${q}%`)
      .neq('id', user.id)
      .limit(10)
    setSearchResults(data || [])
    setSearching(false)
  }

  function timeAgo(ts) {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'now'
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    return `${Math.floor(hrs / 24)}d`
  }

  const selectedProfile = selectedUserId ? profiles[selectedUserId] : null

  return (
    <div className="page" style={{ maxWidth: 900, padding: '1.5rem' }}>
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <h1>💬 Messages</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.25rem', height: 600, maxHeight: '70vh' }}>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: '0.9rem' }}>Conversations</span>
            <button
              className="btn btn-primary btn-sm"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
              onClick={() => setShowSearch(v => !v)}
            >
              + New
            </button>
          </div>

          {showSearch && (
            <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
              <input
                className="input"
                style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
                placeholder="Search users…"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                autoFocus
              />
              {searching && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>Searching…</div>}
              {searchResults.map(p => (
                <div
                  key={p.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem', borderRadius: 6, cursor: 'pointer', marginTop: '0.25rem' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  onClick={() => startNewConversation(p)}
                >
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : '👤'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-h)' }}>
                      {p.display_name || 'User'} {p.verified && <span style={{ color: '#60a5fa' }}>✓</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.role || 'fan'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
            ) : conversations.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                No messages yet.<br />Start a conversation!
              </div>
            ) : (
              conversations.map(conv => {
                const last = conv.messages[conv.messages.length - 1]
                const p = conv.profile
                const isActive = selectedUserId === conv.userId
                return (
                  <div
                    key={conv.userId}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.75rem 1rem', cursor: 'pointer',
                      background: isActive ? 'var(--surface-2)' : 'transparent',
                      borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                      transition: 'background 0.15s',
                    }}
                    onClick={() => selectConversation(conv)}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                      {p?.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : '👤'}
                      {conv.unread > 0 && (
                        <span style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: conv.unread > 0 ? 700 : 500, color: 'var(--text-h)', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p?.display_name || 'User'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {last?.sender_id === user.id ? 'You: ' : ''}{last?.body || ''}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {last ? timeAgo(last.created_at) : ''}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Thread panel */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {!selectedUserId ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '0.75rem' }}>
              <div style={{ fontSize: '3rem' }}>💬</div>
              <div style={{ fontSize: '0.9rem' }}>Select a conversation or start a new one</div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {selectedProfile?.avatar_url ? <img src={selectedProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : '👤'}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: '0.9375rem' }}>
                    {selectedProfile?.display_name || 'User'}
                    {selectedProfile?.verified && <span style={{ color: '#60a5fa', marginLeft: '0.25rem', fontSize: '0.875rem' }}>✓</span>}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {thread.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '2rem' }}>
                    No messages yet. Say hello!
                  </div>
                ) : (
                  thread.map(m => {
                    const isMine = m.sender_id === user.id
                    return (
                      <div key={m.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                          maxWidth: '72%', padding: '0.625rem 0.875rem',
                          borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          background: isMine ? 'linear-gradient(135deg, var(--accent), var(--accent-2))' : 'var(--surface-2)',
                          color: isMine ? '#fff' : 'var(--text-h)',
                          fontSize: '0.9rem', lineHeight: 1.5,
                        }}>
                          <div>{m.body}</div>
                          <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '0.25rem', textAlign: 'right' }}>
                            {timeAgo(m.created_at)}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Compose */}
              <form onSubmit={sendMessage} style={{ padding: '0.875rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.625rem' }}>
                <input
                  className="input"
                  style={{ flex: 1, padding: '0.625rem 0.875rem', fontSize: '0.9rem' }}
                  placeholder="Type a message…"
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e) } }}
                />
                <button className="btn btn-primary" type="submit" disabled={sending || !newMsg.trim()} style={{ padding: '0.625rem 1rem', flexShrink: 0 }}>
                  {sending ? '…' : 'Send'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
