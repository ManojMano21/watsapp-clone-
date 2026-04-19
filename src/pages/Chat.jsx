import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useSocket } from '../hooks/useSocket'
import { supabase } from '../supabase/config'

function getChatId(a, b) { return [a, b].sort().join('_') }
function fmtTime(ts) { if (!ts) return ''; const d = new Date(ts); return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) }
function fmtDate(ts) { if (!ts) return ''; const d = new Date(ts); const now = new Date(); if (d.toDateString() === now.toDateString()) return 'Today'; const y = new Date(now); y.setDate(y.getDate() - 1); if (d.toDateString() === y.toDateString()) return 'Yesterday'; return d.toLocaleDateString() }
function fmtChatTime(ts) { if (!ts) return ''; const d = new Date(ts); const now = new Date(); if (d.toDateString() === now.toDateString()) return fmtTime(ts); const diff = now - d; if (diff < 172800000) return 'Yesterday'; if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' }); return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' }) }
function fmtStatusTime(ts) { if (!ts) return ''; const d = new Date(ts); const diff = new Date() - d; if (diff < 60000) return 'Just now'; if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago'; if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago'; return 'Yesterday' }
function fmtCallDuration(s) { const m = Math.floor(s / 60); const sec = s % 60; return `${m}:${sec < 10 ? '0' : ''}${sec}` }

const STATUS_COLORS = ['#00a884', '#128c7e', '#075e54', '#25d366', '#1da1f2', '#e84393', '#6c5ce7', '#fd79a8', '#fdcb6e', '#e17055', '#d63031', '#636e72']
const MEMBER_COLORS = ['#00a884', '#1da1f2', '#e84393', '#6c5ce7', '#fdcb6e', '#e17055', '#fd79a8', '#128c7e']
const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] }

const Avatar = ({ src, size = 40, name = '', isGroup = false }) => (
  src ? <img src={src} alt="" referrerPolicy="no-referrer" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  : isGroup
    ? <div style={{ width: size, height: size, borderRadius: '50%', background: '#2a3942', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="#aebac1"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      </div>
    : <div style={{ width: size, height: size, borderRadius: '50%', background: '#6b7b8a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#dfe5e7', fontSize: size * 0.45, fontWeight: 600 }}>
        {name ? name[0].toUpperCase() : <svg width={size*0.5} height={size*0.5} viewBox="0 0 24 24" fill="#dfe5e7"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>}
      </div>
)

const ChatSkeleton = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
    <div className="skeleton-circle" style={{ width: 49, height: 49, flexShrink: 0 }} />
    <div style={{ flex: 1 }}>
      <div className="skeleton-line" style={{ width: '55%', height: 14, marginBottom: 8 }} />
      <div className="skeleton-line" style={{ width: '80%', height: 12 }} />
    </div>
    <div className="skeleton-line" style={{ width: 32, height: 10 }} />
  </div>
)

const ChatIcon = ({ active }) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#00a884' : '#aebac1'} strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
const StatusIcon = ({ active }) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#00a884' : '#aebac1'} strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="4 2"/><circle cx="12" cy="12" r="4" fill={active ? '#00a884' : 'none'}/></svg>
const ChannelsIcon = ({ active }) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#00a884' : '#aebac1'} strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const SettingsIcon = ({ active }) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#00a884' : '#aebac1'} strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>

export default function Chat() {
  const { currentUser, logout, updateProfile } = useAuth()
  const { showToast } = useToast()
  const userProfile = currentUser
  const { onlineUsers, typingUsers, incomingCall, callAccepted, callRejected, callUnavailable, callEnded, remoteOffer, remoteAnswer, joinChat, sendMessage: socketSend, startTyping, stopTyping, onMessage, onNewChat, initiateCall, acceptCall, rejectCall, sendOffer, sendAnswer, sendIceCandidate, endCall: socketEndCall, registerIceCandidateHandler, resetCallState } = useSocket(userProfile)

  const [activeTab, setActiveTab] = useState('chats')
  const [chats, setChats] = useState([])
  const [chatsLoading, setChatsLoading] = useState(true)
  const [unreadCounts, setUnreadCounts] = useState({})
  const [activeChat, setActiveChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [msgSearch, setMsgSearch] = useState('')
  const [showMsgSearch, setShowMsgSearch] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const [newChatSearch, setNewChatSearch] = useState('')
  const [showAttach, setShowAttach] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [otherUser, setOtherUser] = useState(null)
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [showContactInfo, setShowContactInfo] = useState(false)
  const [contactMedia, setContactMedia] = useState([])
  const [statuses, setStatuses] = useState([])
  const [myStatuses, setMyStatuses] = useState([])
  const [showStatusComposer, setShowStatusComposer] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [statusBgColor, setStatusBgColor] = useState('#00a884')
  const [viewingStatus, setViewingStatus] = useState(null)
  const [viewingStatusIndex, setViewingStatusIndex] = useState(0)
  const [statusProgress, setStatusProgress] = useState(0)
  const [contextMenu, setContextMenu] = useState(null)
  const [showProfileEdit, setShowProfileEdit] = useState(false)
  const [editName, setEditName] = useState('')
  const [editAbout, setEditAbout] = useState('')
  const [editPhotoFile, setEditPhotoFile] = useState(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState(null)
  const [editLoading, setEditLoading] = useState(false)
  const editPhotoRef = useRef(null)
  const [callState, setCallState] = useState(null)
  const [callType, setCallType] = useState(null)
  const [callPeer, setCallPeer] = useState(null)
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)

  // ── Group creation state ──────────────────────────────────────────────────
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupPhotoFile, setGroupPhotoFile] = useState(null)
  const [groupPhotoPreview, setGroupPhotoPreview] = useState(null)
  const [selectedMembers, setSelectedMembers] = useState([])
  const [groupMemberSearch, setGroupMemberSearch] = useState('')
  const [groupCreating, setGroupCreating] = useState(false)
  const groupPhotoRef = useRef(null)

  const endRef = useRef(null)
  const textRef = useRef(null)
  const imgRef = useRef(null)
  const docRef = useRef(null)
  const statusImgRef = useRef(null)
  const typingTimer = useRef(null)
  const statusTimerRef = useRef(null)
  const peerConnection = useRef(null)
  const localStream = useRef(null)
  const remoteStream = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const callDurationTimer = useRef(null)
  const iceCandidateQueue = useRef([])

  const scroll = useCallback(() => { setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 60) }, [])

  useEffect(() => {
    const handler = () => setContextMenu(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const loadChats = useCallback(async () => {
    if (!currentUser?.id) return
    setChatsLoading(true)
    const { data: participantRows } = await supabase.from('chat_participants').select('chat_id').eq('user_id', currentUser.id)
    if (!participantRows?.length) { setChats([]); setChatsLoading(false); return }
    const chatIds = participantRows.map(r => r.chat_id)
    const { data: chatRows } = await supabase.from('chats').select('*').in('id', chatIds).order('updated_at', { ascending: false })
    if (!chatRows) { setChats([]); setChatsLoading(false); return }
    const enriched = await Promise.all(chatRows.map(async (chat) => {
      const { data: participants } = await supabase.from('chat_participants').select('user_id').eq('chat_id', chat.id)
      if (chat.is_group) {
        const memberIds = participants?.map(p => p.user_id) || []
        const { data: members } = await supabase.from('users').select('id, display_name, photo_url, about, phone_number').in('id', memberIds)
        return { ...chat, groupMembers: members || [], otherUser: null }
      } else {
        const otherUserId = participants?.find(p => p.user_id !== currentUser.id)?.user_id
        let other = {}
        if (otherUserId) { const { data: d } = await supabase.from('users').select('*').eq('id', otherUserId).single(); if (d) other = d }
        return { ...chat, otherUser: other, groupMembers: null }
      }
    }))
    setChats(enriched)
    const counts = {}
    await Promise.all(enriched.map(async (chat) => {
      const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('chat_id', chat.id).eq('read', false).neq('sender_id', currentUser.id)
      counts[chat.id] = count || 0
    }))
    setUnreadCounts(counts)
    setChatsLoading(false)
  }, [currentUser?.id])

  useEffect(() => { loadChats() }, [loadChats])
  useEffect(() => { if (!currentUser?.id) return; const ch = supabase.channel('chats-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => loadChats()).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_participants' }, () => loadChats()).subscribe(); return () => { supabase.removeChannel(ch) } }, [currentUser?.id, loadChats])

  const loadMessages = useCallback(async (chatId) => {
    if (!chatId) { setMessages([]); return }
    const { data } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true })
    setMessages(data || []); scroll()
    if (data?.length) { const ids = data.filter(m => m.sender_id !== currentUser.id && !m.read).map(m => m.id); if (ids.length) { await supabase.from('messages').update({ read: true }).in('id', ids); setUnreadCounts(prev => ({ ...prev, [chatId]: 0 })) } }
  }, [currentUser?.id, scroll])

  useEffect(() => {
    if (!activeChat?.id) { setMessages([]); return }
    joinChat(activeChat.id); loadMessages(activeChat.id)
    const ch = supabase.channel(`msg-${activeChat.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${activeChat.id}` }, (p) => {
      if (p.eventType === 'INSERT') { setMessages(prev => prev.find(m => m.id === p.new.id) ? prev : [...prev, p.new]); scroll(); if (p.new.sender_id !== currentUser.id && !p.new.read) supabase.from('messages').update({ read: true }).eq('id', p.new.id).then() }
      else if (p.eventType === 'UPDATE') setMessages(prev => prev.map(m => m.id === p.new.id ? p.new : m))
    }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [activeChat?.id, currentUser?.id, joinChat, loadMessages, scroll])

  useEffect(() => { const o1 = onMessage((d) => { if (d.chatId === activeChat?.id) scroll() }); const o2 = onNewChat(() => loadChats()); return () => { o1?.(); o2?.() } }, [activeChat?.id, onMessage, onNewChat, scroll, loadChats])

  // Only subscribe to otherUser changes for 1-on-1 chats
  useEffect(() => {
    if (!activeChat?.otherUser?.id || activeChat?.is_group) { setOtherUser(null); return }
    supabase.from('users').select('*').eq('id', activeChat.otherUser.id).single().then(({ data }) => { if (data) setOtherUser(data) })
    const ch = supabase.channel(`usr-${activeChat.otherUser.id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${activeChat.otherUser.id}` }, (p) => setOtherUser(p.new)).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [activeChat?.otherUser?.id, activeChat?.is_group])

  const loadStatuses = useCallback(async () => {
    if (!currentUser?.id) return
    try {
      const { data, error } = await supabase.from('statuses').select('*, users!statuses_user_id_fkey(id, display_name, photo_url)').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false })
      if (error) { console.log('Status table not ready:', error.message); return }
      setMyStatuses((data || []).filter(s => s.user_id === currentUser.id))
      const grouped = {}
      ;(data || []).filter(s => s.user_id !== currentUser.id).forEach(s => { if (!grouped[s.user_id]) grouped[s.user_id] = { user: s.users || { id: s.user_id, display_name: 'Unknown' }, statuses: [] }; grouped[s.user_id].statuses.push(s) })
      setStatuses(Object.values(grouped))
    } catch (e) { console.log('Status not available:', e.message) }
  }, [currentUser?.id])
  useEffect(() => { if (activeTab === 'status') loadStatuses() }, [activeTab, loadStatuses])

  const loadContactMedia = useCallback(async () => { if (!activeChat?.id) return; const { data } = await supabase.from('messages').select('*').eq('chat_id', activeChat.id).in('type', ['image', 'document']).order('created_at', { ascending: false }).limit(20); setContactMedia(data || []) }, [activeChat?.id])
  useEffect(() => { if (showContactInfo) loadContactMedia() }, [showContactInfo, loadContactMedia])

  const handleSend = async () => {
    if (previewFile) { await handleSendFile(); return }
    if (!text.trim() || !activeChat?.id) return
    const msg = text.trim(); setText(''); if (textRef.current) textRef.current.style.height = 'auto'
    if (!activeChat.is_group) stopTyping(activeChat.id, currentUser.id)
    const { data: newMsg } = await supabase.from('messages').insert({ chat_id: activeChat.id, sender_id: currentUser.id, text: msg, type: 'text', read: false }).select().single()
    if (newMsg && !activeChat.is_group) socketSend({ chatId: activeChat.id, id: newMsg.id, ...newMsg, senderName: userProfile?.display_name, recipientId: activeChat.otherUser?.id })
    await supabase.from('chats').update({ last_message_text: msg, last_message_sender: currentUser.id, last_message_type: 'text', last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', activeChat.id)
  }

  const handleSendFile = async () => {
    if (!previewFile || !activeChat?.id) return; setUploading(true)
    try {
      const { file, type } = previewFile; const fp = `${activeChat.id}/${Date.now()}_${file.name}`
      const { error: ue } = await supabase.storage.from('chat-files').upload(fp, file); if (ue) throw ue
      const { data: u } = supabase.storage.from('chat-files').getPublicUrl(fp)
      await supabase.from('messages').insert({ chat_id: activeChat.id, sender_id: currentUser.id, text: text.trim() || null, type, file_url: u.publicUrl, file_name: file.name, file_size: file.size, read: false })
      await supabase.from('chats').update({ last_message_text: type === 'image' ? 'Photo' : `${file.name}`, last_message_sender: currentUser.id, last_message_type: type, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', activeChat.id)
      setPreviewFile(null); setText('')
    } catch (e) { console.error('Upload error:', e) } finally { setUploading(false) }
  }

  // ── Group creation ────────────────────────────────────────────────────────
  const openNewGroup = async () => {
    setShowNewGroup(true)
    setGroupName(''); setGroupPhotoFile(null); setGroupPhotoPreview(null); setSelectedMembers([]); setGroupMemberSearch('')
    const { data } = await supabase.from('users').select('id, display_name, photo_url, phone_number').neq('id', currentUser.id).order('display_name')
    setAllUsers(data || [])
  }

  const toggleMember = (uid) => {
    setSelectedMembers(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid])
  }

  const handleGroupPhoto = (e) => {
    const f = e.target.files?.[0]; if (!f) return
    if (f.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB', 'error'); return }
    setGroupPhotoFile(f); setGroupPhotoPreview(URL.createObjectURL(f))
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim()) { showToast('Enter a group name', 'error'); return }
    if (selectedMembers.length < 1) { showToast('Add at least 1 member', 'error'); return }
    setGroupCreating(true)
    try {
      const chatId = `group_${Date.now()}_${currentUser.id}`
      let photoUrl = ''
      if (groupPhotoFile) {
        const fp = `groups/${chatId}`
        const { error: ue } = await supabase.storage.from('chat-files').upload(fp, groupPhotoFile, { upsert: true })
        if (!ue) { const { data: u } = supabase.storage.from('chat-files').getPublicUrl(fp); photoUrl = u.publicUrl }
      }
      await supabase.from('chats').insert({ id: chatId, is_group: true, group_name: groupName.trim(), group_photo_url: photoUrl, created_by: currentUser.id, updated_at: new Date().toISOString() })
      const allParticipants = [currentUser.id, ...selectedMembers].map(uid => ({ chat_id: chatId, user_id: uid }))
      await supabase.from('chat_participants').insert(allParticipants)
      setShowNewGroup(false); loadChats()
      showToast(`Group "${groupName.trim()}" created!`, 'success')
    } catch (e) { showToast('Failed to create group', 'error'); console.error(e) }
    finally { setGroupCreating(false) }
  }

  const openProfileEdit = () => { setEditName(userProfile?.display_name || ''); setEditAbout(userProfile?.about || ''); setEditPhotoFile(null); setEditPhotoPreview(null); setShowProfileEdit(true) }
  const handleEditPhoto = (e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB', 'error'); return }; setEditPhotoFile(f); setEditPhotoPreview(URL.createObjectURL(f)) }
  const handleSaveProfile = async () => {
    if (!editName.trim()) { showToast('Name cannot be empty', 'error'); return }
    setEditLoading(true)
    try { await updateProfile({ name: editName.trim(), about: editAbout, photoFile: editPhotoFile }); showToast('Profile updated!', 'success'); setShowProfileEdit(false) }
    catch (e) { showToast(e.message || 'Failed to update', 'error') }
    finally { setEditLoading(false) }
  }

  const handleMsgContextMenu = (e, msg) => { if (!msg.text) return; e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, text: msg.text }) }
  const handleCopyMessage = async () => {
    if (!contextMenu?.text) return
    try { await navigator.clipboard.writeText(contextMenu.text); showToast('Message copied!', 'success') }
    catch { showToast('Failed to copy', 'error') }
    setContextMenu(null)
  }

  const handlePostTextStatus = async () => { if (!statusText.trim()) return; try { await supabase.from('statuses').insert({ user_id: currentUser.id, type: 'text', text: statusText.trim(), bg_color: statusBgColor }); setStatusText(''); setShowStatusComposer(false); loadStatuses() } catch (e) { console.error(e) } }
  const handlePostImageStatus = async (e) => { const f = e.target.files?.[0]; if (!f) return; e.target.value = ''; try { const fp = `statuses/${currentUser.id}/${Date.now()}_${f.name}`; const { error: ue } = await supabase.storage.from('chat-files').upload(fp, f); if (ue) throw ue; const { data: u } = supabase.storage.from('chat-files').getPublicUrl(fp); await supabase.from('statuses').insert({ user_id: currentUser.id, type: 'image', image_url: u.publicUrl }); loadStatuses() } catch (e) { console.error(e) } }
  const openStatusViewer = async (us, idx = 0) => { setViewingStatus(us); setViewingStatusIndex(idx); setStatusProgress(0); const s = us.statuses[idx]; if (s && s.user_id !== currentUser.id) try { await supabase.from('status_views').upsert({ status_id: s.id, viewer_id: currentUser.id }, { onConflict: 'status_id,viewer_id' }) } catch {} }
  const closeStatusViewer = () => { setViewingStatus(null); setViewingStatusIndex(0); setStatusProgress(0); if (statusTimerRef.current) clearInterval(statusTimerRef.current) }
  useEffect(() => { if (!viewingStatus) return; const D = 5000, I = 50; let e = 0; statusTimerRef.current = setInterval(() => { e += I; setStatusProgress((e/D)*100); if (e >= D) { const n = viewingStatusIndex + 1; if (n < viewingStatus.statuses.length) { setViewingStatusIndex(n); e = 0; setStatusProgress(0) } else closeStatusViewer() } }, I); return () => { if (statusTimerRef.current) clearInterval(statusTimerRef.current) } }, [viewingStatus, viewingStatusIndex])

  const cleanupCall = useCallback(() => {
    if (localStream.current) { localStream.current.getTracks().forEach(t => t.stop()); localStream.current = null }
    if (peerConnection.current) { peerConnection.current.close(); peerConnection.current = null }
    if (callDurationTimer.current) { clearInterval(callDurationTimer.current); callDurationTimer.current = null }
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    remoteStream.current = null; iceCandidateQueue.current = []; registerIceCandidateHandler(null)
    setCallState(null); setCallType(null); setCallPeer(null); setCallDuration(0); setIsMuted(false); setIsCameraOff(false); resetCallState()
  }, [resetCallState, registerIceCandidateHandler])

  const createPC = useCallback((peerId, label) => {
    const pc = new RTCPeerConnection(ICE_SERVERS); peerConnection.current = pc; iceCandidateQueue.current = []
    if (localStream.current) { localStream.current.getTracks().forEach(t => pc.addTrack(t, localStream.current)) }
    pc.ontrack = (e) => { remoteStream.current = e.streams[0]; if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]; if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0] }
    pc.onicecandidate = (e) => { if (e.candidate) sendIceCandidate({ targetId: peerId, candidate: e.candidate }) }
    registerIceCandidateHandler(async (candidate) => {
      const currentPC = peerConnection.current; if (!currentPC) return
      if (!currentPC.remoteDescription?.type) { iceCandidateQueue.current.push(candidate); return }
      try { await currentPC.addIceCandidate(new RTCIceCandidate(candidate)) } catch {}
    })
    return pc
  }, [sendIceCandidate, registerIceCandidateHandler])

  const drainIceCandidateQueue = async () => { const pc = peerConnection.current; if (!pc) return; while (iceCandidateQueue.current.length > 0) { const c = iceCandidateQueue.current.shift(); try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch {} } }
  const startCall = useCallback(async (type) => {
    if (!activeChat?.otherUser?.id || activeChat?.is_group || callState) return
    const peer = { id: activeChat.otherUser.id, name: activeChat.otherUser.display_name, photo: activeChat.otherUser.photo_url }
    setCallPeer(peer); setCallType(type); setCallState('calling')
    initiateCall({ callerId: currentUser.id, callerName: userProfile?.display_name, callerPhoto: userProfile?.photo_url, recipientId: peer.id, callType: type })
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' }); localStream.current = stream; if (localVideoRef.current && type === 'video') localVideoRef.current.srcObject = stream } catch (e) { console.error('Media error:', e); cleanupCall() }
  }, [activeChat, callState, currentUser, userProfile, initiateCall, cleanupCall])

  const handleAcceptCall = useCallback(async () => {
    if (!incomingCall) return
    const peer = { id: incomingCall.callerId, name: incomingCall.callerName, photo: incomingCall.callerPhoto }; const cType = incomingCall.callType
    setCallPeer(peer); setCallType(cType); setCallState('connected')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: cType === 'video' }); localStream.current = stream
      if (localVideoRef.current && cType === 'video') localVideoRef.current.srcObject = stream
      createPC(peer.id, 'answerer'); acceptCall({ callerId: incomingCall.callerId, recipientId: currentUser.id })
      callDurationTimer.current = setInterval(() => setCallDuration(p => p + 1), 1000)
    } catch (e) { console.error('Media error:', e); cleanupCall() }
  }, [incomingCall, currentUser, acceptCall, createPC, cleanupCall])

  const handleRejectCall = useCallback(() => { if (!incomingCall) return; rejectCall({ callerId: incomingCall.callerId, recipientId: currentUser.id }) }, [incomingCall, currentUser, rejectCall])
  const handleEndCall = useCallback(() => { if (callPeer?.id) socketEndCall({ targetId: callPeer.id }); cleanupCall() }, [callPeer, socketEndCall, cleanupCall])
  const toggleMute = () => { if (localStream.current) { localStream.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled }); setIsMuted(p => !p) } }
  const toggleCamera = () => { if (localStream.current) { localStream.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled }); setIsCameraOff(p => !p) } }
  useEffect(() => { if (!callAccepted || !callPeer?.id) return; (async () => { try { const pc = createPC(callPeer.id, 'caller'); setCallState('connected'); const offer = await pc.createOffer(); await pc.setLocalDescription(offer); sendOffer({ targetId: callPeer.id, offer }); callDurationTimer.current = setInterval(() => setCallDuration(p => p + 1), 1000) } catch (e) { console.error(e); cleanupCall() } })() }, [callAccepted, callPeer?.id, sendOffer, createPC, cleanupCall])
  useEffect(() => { if (callRejected) cleanupCall() }, [callRejected, cleanupCall])
  useEffect(() => { if (callUnavailable) cleanupCall() }, [callUnavailable, cleanupCall])
  useEffect(() => { if (callEnded) cleanupCall() }, [callEnded, cleanupCall])
  useEffect(() => { if (!remoteOffer || !peerConnection.current) return; (async () => { try { await peerConnection.current.setRemoteDescription(new RTCSessionDescription(remoteOffer.offer)); await drainIceCandidateQueue(); const answer = await peerConnection.current.createAnswer(); await peerConnection.current.setLocalDescription(answer); sendAnswer({ targetId: remoteOffer.callerId, answer }) } catch (e) { console.error(e) } })() }, [remoteOffer, sendAnswer])
  useEffect(() => { if (!remoteAnswer || !peerConnection.current) return; (async () => { try { await peerConnection.current.setRemoteDescription(new RTCSessionDescription(remoteAnswer.answer)); await drainIceCandidateQueue() } catch (e) { console.error(e) } })() }, [remoteAnswer])

  const handleNewChat = async () => { setShowNewChat(true); const { data } = await supabase.from('users').select('*').neq('id', currentUser.id).order('display_name'); setAllUsers(data || []) }
  const handleSelectUser = async (user) => {
    const chatId = getChatId(currentUser.id, user.id)
    const { data: ex } = await supabase.from('chats').select('id').eq('id', chatId).maybeSingle()
    if (!ex) { await supabase.from('chats').insert({ id: chatId, updated_at: new Date().toISOString() }); await supabase.from('chat_participants').insert([{ chat_id: chatId, user_id: currentUser.id }, { chat_id: chatId, user_id: user.id }]) }
    setActiveChat({ id: chatId, otherUser: user }); setShowNewChat(false); setNewChatSearch(''); setShowMobileChat(true); setActiveTab('chats')
  }
  const handleTyping = () => { if (activeChat?.is_group) return; startTyping(activeChat?.id, currentUser.id, userProfile?.display_name); clearTimeout(typingTimer.current); typingTimer.current = setTimeout(() => stopTyping(activeChat?.id, currentUser.id), 2000) }
  const handleFileSelect = (e, type) => { const f = e.target.files?.[0]; if (f) { setPreviewFile({ file: f, type }); setShowAttach(false) } e.target.value = '' }

  const filteredChats = chats.filter(c => !search || (c.is_group ? c.group_name?.toLowerCase().includes(search.toLowerCase()) : c.otherUser?.display_name?.toLowerCase().includes(search.toLowerCase())))
  const filteredUsers = allUsers.filter(u => !newChatSearch || u.display_name?.toLowerCase().includes(newChatSearch.toLowerCase()) || u.phone_number?.includes(newChatSearch))
  const filteredGroupUsers = allUsers.filter(u => !groupMemberSearch || u.display_name?.toLowerCase().includes(groupMemberSearch.toLowerCase()) || u.phone_number?.includes(groupMemberSearch))

  const grouped = []; let lastDate = ''
  messages.forEach((msg, i) => { const d = fmtDate(msg.created_at); if (d && d !== lastDate) { grouped.push({ type: 'date', date: d }); lastDate = d }; grouped.push({ type: 'msg', msg, tail: !messages[i - 1] || messages[i - 1].sender_id !== msg.sender_id }) })
  const displayGrouped = !msgSearch ? grouped : grouped.filter(item => item.type !== 'date' && item.msg?.text?.toLowerCase().includes(msgSearch.toLowerCase()))
  const isOnline = (uid) => onlineUsers.includes(uid)
  const getTyping = () => { if (!activeChat?.otherUser?.id || activeChat?.is_group) return null; return typingUsers[activeChat.otherUser.id] }

  // Build sender map for group messages
  const senderMap = {}
  if (activeChat?.is_group && activeChat?.groupMembers) {
    activeChat.groupMembers.forEach((m, i) => { senderMap[m.id] = { ...m, color: MEMBER_COLORS[i % MEMBER_COLORS.length] } })
  }

  // Chat display helpers
  const getChatName = (chat) => chat.is_group ? (chat.group_name || 'Group') : (chat.otherUser?.display_name || 'Unknown')
  const getChatPhoto = (chat) => chat.is_group ? chat.group_photo_url : chat.otherUser?.photo_url

  return (
    <div className="app-container" onClick={() => contextMenu && setContextMenu(null)}>
      <div className="green-bar" />
      <div className="main-container">
        <div className="nav-sidebar">
          <div className="nav-sidebar-top">
            <button className={'nav-icon-btn' + (activeTab === 'chats' ? ' active' : '')} onClick={() => setActiveTab('chats')} title="Chats"><ChatIcon active={activeTab === 'chats'} /></button>
            <button className={'nav-icon-btn' + (activeTab === 'status' ? ' active' : '')} onClick={() => setActiveTab('status')} title="Status"><StatusIcon active={activeTab === 'status'} /></button>
            <button className={'nav-icon-btn' + (activeTab === 'channels' ? ' active' : '')} onClick={() => setActiveTab('channels')} title="Communities"><ChannelsIcon active={activeTab === 'channels'} /></button>
          </div>
          <div className="nav-sidebar-bottom">
            <button className={'nav-icon-btn' + (activeTab === 'settings' ? ' active' : '')} onClick={() => setActiveTab('settings')} title="Settings"><SettingsIcon active={activeTab === 'settings'} /></button>
            <div className="nav-avatar" onClick={() => setActiveTab('settings')}><Avatar src={userProfile?.photo_url} size={32} name={userProfile?.display_name} /></div>
          </div>
        </div>

        <div className={'sidebar' + (showMobileChat ? ' mobile-hidden' : '')}>
          {activeTab === 'chats' && (<>
            {/* ── New Chat overlay ── */}
            {showNewChat && (<div className="new-chat-overlay"><div className="new-chat-header"><button onClick={() => setShowNewChat(false)}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg></button><h2>New chat</h2></div><div className="sidebar-search"><div className="search-box"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input className="search-input" placeholder="Search name or phone" value={newChatSearch} onChange={e => setNewChatSearch(e.target.value)} autoFocus /></div></div><div className="user-list">{filteredUsers.length === 0 ? <div className="chat-list-empty">{newChatSearch ? 'No users found' : 'No other users yet.'}</div> : filteredUsers.map(u => (<div key={u.id} className="user-item" onClick={() => handleSelectUser(u)}><div style={{ position: 'relative' }}><Avatar src={u.photo_url} size={49} name={u.display_name} />{isOnline(u.id) && <div className="online-dot" />}</div><div className="user-item-info"><div className="user-item-name">{u.display_name}</div><div className="user-item-about">{u.about || u.phone_number}</div></div></div>))}</div></div>)}

            {/* ── New Group overlay ── */}
            {showNewGroup && (
              <div className="new-chat-overlay">
                <div className="new-chat-header">
                  <button onClick={() => setShowNewGroup(false)}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg></button>
                  <h2>New group</h2>
                </div>
                {/* Group photo + name */}
                <div style={{ padding: '16px', borderBottom: '1px solid #2a3942' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                    <div onClick={() => groupPhotoRef.current?.click()} style={{ width: 56, height: 56, borderRadius: '50%', background: '#2a3942', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                      {groupPhotoPreview ? <img src={groupPhotoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#aebac1" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>}
                      <input ref={groupPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleGroupPhoto} />
                    </div>
                    <input className="search-input" style={{ flex: 1, padding: '8px 0', borderBottom: '2px solid #00a884', background: 'none', fontSize: 16, color: '#e9edef' }} placeholder="Group name" value={groupName} onChange={e => setGroupName(e.target.value)} autoFocus maxLength={50} />
                  </div>
                  {selectedMembers.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {selectedMembers.map(uid => { const u = allUsers.find(x => x.id === uid); return u ? <span key={uid} style={{ background: '#00a884', color: '#fff', borderRadius: 16, padding: '3px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>{u.display_name}<button onClick={() => toggleMember(uid)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button></span> : null })}
                    </div>
                  )}
                </div>
                <div className="sidebar-search"><div className="search-box"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input className="search-input" placeholder="Add members" value={groupMemberSearch} onChange={e => setGroupMemberSearch(e.target.value)} /></div></div>
                <div className="user-list">
                  {filteredGroupUsers.map(u => (
                    <div key={u.id} className="user-item" onClick={() => toggleMember(u.id)} style={{ background: selectedMembers.includes(u.id) ? '#182229' : undefined }}>
                      <div style={{ position: 'relative' }}>
                        <Avatar src={u.photo_url} size={49} name={u.display_name} />
                        {selectedMembers.includes(u.id) && <div style={{ position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, background: '#00a884', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>}
                      </div>
                      <div className="user-item-info"><div className="user-item-name">{u.display_name}</div><div className="user-item-about">{u.phone_number}</div></div>
                    </div>
                  ))}
                </div>
                {selectedMembers.length > 0 && groupName.trim() && (
                  <div style={{ padding: 16, borderTop: '1px solid #2a3942' }}>
                    <button className="btn-primary" onClick={handleCreateGroup} disabled={groupCreating} style={{ width: '100%' }}>
                      {groupCreating ? 'Creating...' : `Create group · ${selectedMembers.length + 1} members`}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="sidebar-header">
              <div className="sidebar-header-left"><span style={{ color: '#e9edef', fontSize: 20, fontWeight: 600 }}>Chats</span></div>
              <div className="sidebar-header-right">
                {/* New Group button */}
                <button className="icon-btn" onClick={openNewGroup} title="New group" style={{ marginRight: 2 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                </button>
                <button className="icon-btn" onClick={handleNewChat} title="New chat"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg></button>
                <button className="icon-btn desktop-logout" onClick={logout} title="Logout"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>
              </div>
            </div>
            <div className="sidebar-search"><div className="search-box"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input className="search-input" placeholder="Search or start a new chat" value={search} onChange={e => setSearch(e.target.value)} /></div></div>
            <div className="chat-list">
              {chatsLoading ? [1,2,3,4,5].map(i => <ChatSkeleton key={i} />) : filteredChats.length === 0 ? (
                <div className="chat-list-empty"><div style={{ textAlign: 'center' }}><p>{search ? 'No chats found' : 'No conversations yet'}</p>{!search && <button className="btn-primary" style={{ marginTop: 16, fontSize: 13, padding: '8px 20px' }} onClick={handleNewChat}>+ Start a chat</button>}</div></div>
              ) : filteredChats.map(chat => {
                const isOwn = chat.last_message_sender === currentUser.id
                const preview = !chat.last_message_text ? '' : chat.last_message_type === 'image' ? '📷 Photo' : chat.last_message_type === 'document' ? '📄 Document' : chat.last_message_text || ''
                const unread = unreadCounts[chat.id] || 0
                const chatName = getChatName(chat)
                const chatPhoto = getChatPhoto(chat)
                return (
                  <div key={chat.id} className={'chat-item' + (activeChat?.id === chat.id ? ' active' : '')} onClick={() => { setActiveChat(chat); setShowMobileChat(true); setShowContactInfo(false); setUnreadCounts(prev => ({ ...prev, [chat.id]: 0 })) }}>
                    <div style={{ position: 'relative' }}>
                      <Avatar src={chatPhoto} size={49} name={chatName} isGroup={chat.is_group} />
                      {!chat.is_group && isOnline(chat.otherUser?.id) && <div className="online-dot" />}
                    </div>
                    <div className="chat-info">
                      <div className="chat-info-top">
                        <span className="chat-name" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {chat.is_group && <svg width="13" height="13" viewBox="0 0 24 24" fill="#aebac1"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
                          {chatName}
                        </span>
                        <span className="chat-time" style={{ color: unread > 0 ? '#00a884' : undefined }}>{fmtChatTime(chat.last_message_at)}</span>
                      </div>
                      <div className="chat-info-bottom">
                        <span className="chat-preview">{isOwn && !unread && <span className="ticks">✓✓ </span>}{preview.length > 40 ? preview.slice(0, 40) + '\u2026' : preview}</span>
                        {unread > 0 && <span className="unread-badge">{unread > 99 ? '99+' : unread}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>)}

          {activeTab === 'status' && (<>
            <div className="sidebar-header"><div className="sidebar-header-left"><span style={{ color: '#e9edef', fontSize: 20, fontWeight: 600 }}>Status</span></div><div className="sidebar-header-right"><button className="icon-btn" onClick={() => setShowStatusComposer(true)} title="New status"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button></div></div>
            <div className="status-list">
              <div className="status-my" onClick={() => { if (myStatuses.length > 0) openStatusViewer({ user: { ...userProfile }, statuses: myStatuses }); else setShowStatusComposer(true) }}><div className="status-avatar-ring" style={{ borderColor: myStatuses.length > 0 ? '#00a884' : '#374955' }}><Avatar src={userProfile?.photo_url} size={49} name={userProfile?.display_name} />{myStatuses.length === 0 && <div className="status-add-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div>}</div><div className="user-item-info"><div className="user-item-name">My status</div><div className="user-item-about">{myStatuses.length > 0 ? fmtStatusTime(myStatuses[0].created_at) : 'Click to add status update'}</div></div></div>
              {statuses.length > 0 && (<><div className="status-section-label">Recent updates</div>{statuses.map(s => (<div key={s.user.id} className="status-item" onClick={() => openStatusViewer(s)}><div className="status-avatar-ring" style={{ borderColor: '#00a884' }}><Avatar src={s.user.photo_url} size={49} name={s.user.display_name} /></div><div className="user-item-info"><div className="user-item-name">{s.user.display_name}</div><div className="user-item-about">{fmtStatusTime(s.statuses[0]?.created_at)}</div></div></div>))}</>)}
              {statuses.length === 0 && myStatuses.length === 0 && <div className="chat-list-empty"><div style={{ textAlign: 'center' }}><p>No status updates yet</p><button className="btn-primary" style={{ marginTop: 16, fontSize: 13, padding: '8px 20px' }} onClick={() => setShowStatusComposer(true)}>+ Add status</button></div></div>}
            </div>
          </>)}

          {activeTab === 'channels' && (<><div className="sidebar-header"><div className="sidebar-header-left"><span style={{ color: '#e9edef', fontSize: 20, fontWeight: 600 }}>Communities</span></div></div><div className="chat-list-empty"><div style={{ textAlign: 'center' }}><svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#374955" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><p style={{ marginTop: 16 }}>Communities coming soon</p></div></div></>)}

          {activeTab === 'settings' && (<>
            <div className="sidebar-header"><div className="sidebar-header-left"><span style={{ color: '#e9edef', fontSize: 20, fontWeight: 600 }}>Settings</span></div></div>
            <div className="settings-panel">
              <div className="settings-profile" style={{ cursor: 'pointer' }} onClick={openProfileEdit}>
                <div style={{ position: 'relative' }}>
                  <Avatar src={userProfile?.photo_url} size={80} name={userProfile?.display_name} />
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, background: '#00a884', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #111b21' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </div>
                </div>
                <div className="settings-profile-info">
                  <div style={{ color: '#e9edef', fontSize: 18 }}>{userProfile?.display_name}</div>
                  <div style={{ color: '#8696a0', fontSize: 14 }}>{userProfile?.about || 'Hey there! I am using WhatsApp.'}</div>
                  <div style={{ color: '#00a884', fontSize: 12, marginTop: 4 }}>Tap to edit profile</div>
                </div>
              </div>
              <div className="settings-items">
                <div className="settings-item" onClick={logout}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ea0038" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg><span style={{ color: '#ea0038' }}>Log out</span></div>
              </div>
            </div>
          </>)}
        </div>

        {/* ── Chat Area ── */}
        <div className={'chat-area' + (showContactInfo ? ' with-contact-info' : '') + (showMobileChat ? ' mobile-visible' : '')}>
          {!activeChat ? (
            <div className="chat-empty"><svg width="250" height="180" viewBox="0 0 300 200" fill="none"><circle cx="150" cy="100" r="80" fill="#182229"/><rect x="115" y="45" width="70" height="110" rx="12" fill="#202c33" stroke="#2a3942" strokeWidth="2"/><rect x="124" y="58" width="52" height="72" rx="4" fill="#0b141a"/><circle cx="150" cy="142" r="5" fill="#2a3942"/></svg><h2>WhatsApp Web</h2><p>Send and receive messages without keeping your phone online.</p><div className="encrypt-text"><svg width="14" height="14" viewBox="0 0 24 24" fill="#667781"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>End-to-end encrypted</div></div>
          ) : (<>
            <div className="chat-header">
              <button className="icon-btn back-btn" onClick={() => { setShowMobileChat(false); setActiveChat(null); setShowContactInfo(false) }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg></button>
              <div className="chat-header-clickable" onClick={() => setShowContactInfo(!showContactInfo)}>
                <Avatar src={getChatPhoto(activeChat)} size={40} name={getChatName(activeChat)} isGroup={activeChat.is_group} />
                <div className="chat-header-info">
                  <div className="chat-header-name">{getChatName(activeChat)}</div>
                  {activeChat.is_group ? (
                    <div className="chat-header-status">{activeChat.groupMembers?.length || 0} members</div>
                  ) : (
                    <div className={'chat-header-status' + (isOnline(activeChat.otherUser?.id) ? ' online' : '') + (getTyping() ? ' typing' : '')}>{getTyping() ? 'typing...' : isOnline(activeChat.otherUser?.id) ? 'online' : otherUser?.last_seen ? 'last seen ' + fmtTime(otherUser.last_seen) : ''}</div>
                  )}
                </div>
              </div>
              <div className="chat-header-actions">
                <button className={'icon-btn' + (showMsgSearch ? ' active-icon' : '')} title="Search messages" onClick={() => { setShowMsgSearch(s => !s); if (showMsgSearch) setMsgSearch('') }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
                {!activeChat.is_group && <>
                  <button className="icon-btn" title="Video call" onClick={() => startCall('video')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg></button>
                  <button className="icon-btn" title="Voice call" onClick={() => startCall('audio')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></button>
                </>}
                <button className="icon-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button>
              </div>
            </div>
            {showMsgSearch && (
              <div style={{ background: '#111b21', padding: '6px 12px', borderBottom: '1px solid #222d34', display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input autoFocus className="search-input" style={{ flex: 1 }} placeholder="Search in conversation..." value={msgSearch} onChange={e => setMsgSearch(e.target.value)} />
                {msgSearch && <button style={{ background: 'none', border: 'none', color: '#8696a0', cursor: 'pointer', fontSize: 16 }} onClick={() => setMsgSearch('')}>✕</button>}
                {msgSearch && <span style={{ color: '#8696a0', fontSize: 12, whiteSpace: 'nowrap' }}>{displayGrouped.filter(i => i.type === 'msg').length} found</span>}
              </div>
            )}
            <div className="messages-area">
              {messages.length === 0 && <div className="date-divider"><span>Messages are end-to-end encrypted.</span></div>}
              {msgSearch && displayGrouped.filter(i => i.type === 'msg').length === 0 && messages.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40 }}><span style={{ background: '#182229', color: '#8696a0', fontSize: 13, padding: '8px 16px', borderRadius: 8 }}>No messages match your search</span></div>
              )}
              {displayGrouped.map((item, i) => {
                if (item.type === 'date') return <div key={'d'+i} className="date-divider"><span>{item.date}</span></div>
                const { msg, tail } = item; const own = msg.sender_id === currentUser.id
                const highlighted = msgSearch && msg.text?.toLowerCase().includes(msgSearch.toLowerCase())
                const sender = senderMap[msg.sender_id]
                return (
                  <div key={msg.id} className={'msg-row ' + (own ? 'out' : 'in')} onContextMenu={(e) => handleMsgContextMenu(e, msg)}>
                    {/* Group: show sender avatar on left */}
                    {activeChat.is_group && !own && tail && (
                      <div style={{ alignSelf: 'flex-end', marginRight: 6, marginBottom: 4, flexShrink: 0 }}>
                        <Avatar src={sender?.photo_url} size={28} name={sender?.display_name} />
                      </div>
                    )}
                    {activeChat.is_group && !own && !tail && <div style={{ width: 34, flexShrink: 0 }} />}
                    <div className={'msg-bubble ' + (own ? 'out' : 'in') + (tail ? ' tail' : '') + (highlighted ? ' msg-highlighted' : '')}>
                      {/* Group: show sender name */}
                      {activeChat.is_group && !own && tail && (
                        <div style={{ color: sender?.color || '#00a884', fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
                          {sender?.display_name || 'Unknown'}
                        </div>
                      )}
                      {msg.type === 'image' && msg.file_url && <img className="msg-image" src={msg.file_url} alt="" onClick={() => window.open(msg.file_url)} />}
                      {msg.type === 'document' && msg.file_url && <a className="msg-doc" href={msg.file_url} target="_blank" rel="noopener noreferrer"><span style={{ fontSize: 24 }}>📄</span><div style={{ flex: 1, minWidth: 0 }}><div className="msg-doc-name">{msg.file_name}</div><div style={{ color: '#8696a0', fontSize: 12 }}>{msg.file_size ? (msg.file_size/1024).toFixed(1)+' KB' : ''}</div></div></a>}
                      {msg.text && <span className="msg-text">{msg.text}</span>}
                      <div className="msg-meta"><span className="msg-time">{fmtTime(msg.created_at)}</span>{own && <span className={'msg-ticks' + (msg.read ? '' : ' sent')}>{msg.read ? '\u2713\u2713' : '\u2713'}</span>}</div>
                      <div style={{ clear: 'both' }} />
                    </div>
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>
            {uploading && <div className="upload-indicator"><p>Uploading...</p></div>}
            {previewFile && <div className="file-preview-bar">{previewFile.type === 'image' ? <img className="file-preview-thumb" src={URL.createObjectURL(previewFile.file)} alt="" /> : <div className="file-preview-placeholder">📄</div>}<div style={{ flex: 1, minWidth: 0 }}><div className="file-preview-name">{previewFile.file.name}</div><div style={{ color: '#8696a0', fontSize: 12 }}>{(previewFile.file.size/1024).toFixed(1)} KB</div></div><button className="file-preview-close" onClick={() => setPreviewFile(null)}>✕</button></div>}
            <div className="msg-input-area" style={{ position: 'relative' }}>
              {showAttach && (<><div className="overlay" onClick={() => setShowAttach(false)} /><div className="attach-menu"><button className="attach-option" onClick={() => imgRef.current?.click()}><div className="attach-icon photo"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>Photos and Videos</button><button className="attach-option" onClick={() => docRef.current?.click()}><div className="attach-icon doc"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>Document</button></div></>)}
              <button className="icon-btn" onClick={() => setShowAttach(!showAttach)}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></button>
              <div className="msg-input-box"><textarea ref={textRef} className="msg-textarea" placeholder="Type a message" rows={1} value={text} onChange={e => { setText(e.target.value); handleTyping() }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }} onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 130) + 'px' }} /></div>
              <button className="send-btn" onClick={handleSend}>{text.trim() || previewFile ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>}</button>
              <input ref={imgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileSelect(e, 'image')} />
              <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" style={{ display: 'none' }} onChange={e => handleFileSelect(e, 'document')} />
            </div>
          </>)}
        </div>

        {/* ── Contact / Group Info Panel ── */}
        {showContactInfo && activeChat && (
          <div className="contact-info-panel">
            <div className="contact-info-header">
              <button className="icon-btn" onClick={() => setShowContactInfo(false)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              <span>{activeChat.is_group ? 'Group info' : 'Contact info'}</span>
            </div>
            <div className="contact-info-body">
              {activeChat.is_group ? (
                <>
                  <div className="contact-info-avatar-section">
                    <Avatar src={activeChat.group_photo_url} size={200} name={activeChat.group_name} isGroup />
                    <h2>{activeChat.group_name}</h2>
                    <p className="contact-info-phone">Group · {activeChat.groupMembers?.length || 0} members</p>
                  </div>
                  <div className="contact-info-section">
                    <label>Members</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                      {(activeChat.groupMembers || []).map((member, i) => (
                        <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ position: 'relative' }}>
                            <Avatar src={member.photo_url} size={38} name={member.display_name} />
                            {isOnline(member.id) && <div className="online-dot" style={{ width: 10, height: 10 }} />}
                          </div>
                          <div>
                            <div style={{ color: '#e9edef', fontSize: 14, fontWeight: 500 }}>
                              {member.id === currentUser.id ? 'You' : member.display_name}
                              {member.id === activeChat.created_by && <span style={{ color: '#00a884', fontSize: 11, marginLeft: 6 }}>Admin</span>}
                            </div>
                            <div style={{ color: '#8696a0', fontSize: 12 }}>{member.about || member.phone_number}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="contact-info-section">
                    <div className="contact-info-section-header"><span>Media, links and docs</span><span className="contact-info-count">{contactMedia.length}</span></div>
                    {contactMedia.length > 0 ? <div className="contact-media-grid">{contactMedia.filter(m => m.type === 'image').slice(0, 6).map(m => <img key={m.id} src={m.file_url} alt="" className="contact-media-thumb" onClick={() => window.open(m.file_url)} />)}</div> : <p className="contact-info-empty">No media shared yet</p>}
                  </div>
                </>
              ) : (
                <>
                  <div className="contact-info-avatar-section">
                    <Avatar src={activeChat.otherUser?.photo_url} size={200} name={activeChat.otherUser?.display_name} />
                    <h2>{activeChat.otherUser?.display_name}</h2>
                    <p className="contact-info-phone">{otherUser?.phone_number || activeChat.otherUser?.phone_number}</p>
                  </div>
                  <div className="contact-info-section"><label>About</label><p>{otherUser?.about || activeChat.otherUser?.about || 'Hey there! I am using WhatsApp.'}</p></div>
                  <div className="contact-info-section"><div className="contact-info-section-header"><span>Media, links and docs</span><span className="contact-info-count">{contactMedia.length}</span></div>{contactMedia.length > 0 ? <div className="contact-media-grid">{contactMedia.filter(m => m.type === 'image').slice(0, 6).map(m => <img key={m.id} src={m.file_url} alt="" className="contact-media-thumb" onClick={() => window.open(m.file_url)} />)}</div> : <p className="contact-info-empty">No media shared yet</p>}</div>
                </>
              )}
            </div>
          </div>
        )}

        <div className={'bottom-nav' + (showMobileChat ? ' mobile-hidden' : '')}>
          <button className={'bottom-nav-item' + (activeTab === 'chats' ? ' active' : '')} onClick={() => { setActiveTab('chats'); setShowMobileChat(false) }}><ChatIcon active={activeTab === 'chats'} /><span>Chats</span></button>
          <button className={'bottom-nav-item' + (activeTab === 'status' ? ' active' : '')} onClick={() => { setActiveTab('status'); setShowMobileChat(false); setActiveChat(null) }}><StatusIcon active={activeTab === 'status'} /><span>Updates</span></button>
          <button className={'bottom-nav-item' + (activeTab === 'channels' ? ' active' : '')} onClick={() => { setActiveTab('channels'); setShowMobileChat(false); setActiveChat(null) }}><ChannelsIcon active={activeTab === 'channels'} /><span>Communities</span></button>
          <button className={'bottom-nav-item' + (activeTab === 'settings' ? ' active' : '')} onClick={() => { setActiveTab('settings'); setShowMobileChat(false); setActiveChat(null) }}><SettingsIcon active={activeTab === 'settings'} /><span>Settings</span></button>
        </div>
      </div>

      {showStatusComposer && (<div className="status-composer-overlay" onClick={() => setShowStatusComposer(false)}><div className="status-composer" onClick={e => e.stopPropagation()}><div className="status-composer-header"><button className="icon-btn" onClick={() => setShowStatusComposer(false)}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button><h3>Create status</h3></div><div className="status-composer-preview" style={{ background: statusBgColor }}><textarea className="status-text-input" placeholder="Type a status" value={statusText} onChange={e => setStatusText(e.target.value)} maxLength={500} autoFocus /></div><div className="status-composer-colors">{STATUS_COLORS.map(c => <button key={c} className={'color-dot' + (statusBgColor === c ? ' active' : '')} style={{ background: c }} onClick={() => setStatusBgColor(c)} />)}</div><div className="status-composer-actions"><button className="status-image-btn" onClick={() => statusImgRef.current?.click()}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>Photo</button><button className="btn-primary" onClick={handlePostTextStatus} disabled={!statusText.trim()}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Post</button></div><input ref={statusImgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePostImageStatus} /></div></div>)}

      {viewingStatus && (<div className="status-viewer-overlay" onClick={closeStatusViewer}><div className="status-viewer" onClick={e => e.stopPropagation()}><div className="status-progress-bar">{viewingStatus.statuses.map((_, i) => <div key={i} className="status-progress-segment"><div className="status-progress-fill" style={{ width: i < viewingStatusIndex ? '100%' : i === viewingStatusIndex ? `${statusProgress}%` : '0%' }} /></div>)}</div><div className="status-viewer-header"><Avatar src={viewingStatus.user?.photo_url} size={36} name={viewingStatus.user?.display_name} /><div><div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>{viewingStatus.user?.display_name}</div><div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{fmtStatusTime(viewingStatus.statuses[viewingStatusIndex]?.created_at)}</div></div><button className="icon-btn" style={{ marginLeft: 'auto', color: '#fff' }} onClick={closeStatusViewer}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><div className="status-viewer-content">{(() => { const s = viewingStatus.statuses[viewingStatusIndex]; if (!s) return null; if (s.type === 'image') return <img src={s.image_url} alt="" className="status-viewer-image" />; return <div className="status-viewer-text" style={{ background: s.bg_color || '#00a884' }}><p>{s.text}</p></div> })()}</div>{viewingStatusIndex > 0 && <button className="status-nav-btn left" onClick={e => { e.stopPropagation(); setViewingStatusIndex(i => i - 1); setStatusProgress(0) }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg></button>}{viewingStatusIndex < viewingStatus.statuses.length - 1 && <button className="status-nav-btn right" onClick={e => { e.stopPropagation(); setViewingStatusIndex(i => i + 1); setStatusProgress(0) }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg></button>}</div></div>)}

      {incomingCall && !callState && (
        <div className="call-overlay"><div className="call-incoming"><Avatar src={incomingCall.callerPhoto} size={100} name={incomingCall.callerName} /><h2>{incomingCall.callerName}</h2><p>{incomingCall.callType === 'video' ? 'Video call' : 'Voice call'}</p><div className="call-incoming-actions"><button className="call-btn reject" onClick={handleRejectCall}><svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg></button><button className="call-btn accept" onClick={handleAcceptCall}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></button></div></div></div>
      )}

      <audio ref={remoteAudioRef} autoPlay playsInline />

      {callState && (
        <div className="call-overlay"><div className="call-active">
          {callType === 'video' && (<div className="call-video-container"><video ref={remoteVideoRef} autoPlay playsInline className="call-video-remote" /><video ref={localVideoRef} autoPlay playsInline muted className="call-video-local" /></div>)}
          {callType === 'audio' && (<div className="call-audio-container"><Avatar src={callPeer?.photo} size={120} name={callPeer?.name} /><h2>{callPeer?.name}</h2><p>{callState === 'calling' ? 'Calling...' : callState === 'ringing' ? 'Ringing...' : fmtCallDuration(callDuration)}</p></div>)}
          {callType === 'video' && (<div className="call-video-info"><h3>{callPeer?.name}</h3><p>{callState === 'calling' ? 'Calling...' : callState === 'ringing' ? 'Ringing...' : fmtCallDuration(callDuration)}</p></div>)}
          <div className="call-controls">
            <button className={'call-control-btn' + (isMuted ? ' active' : '')} onClick={toggleMute}>{isMuted ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2"/></svg> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>}</button>
            {callType === 'video' && (<button className={'call-control-btn' + (isCameraOff ? ' active' : '')} onClick={toggleCamera}>{isCameraOff ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34"/></svg> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>}</button>)}
            <button className="call-control-btn end" onClick={handleEndCall}><svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg></button>
          </div>
        </div></div>
      )}

      {contextMenu && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={e => e.stopPropagation()}>
          <button className="context-menu-item" onClick={handleCopyMessage}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy message
          </button>
        </div>
      )}

      {showProfileEdit && (
        <div className="profile-edit-overlay" onClick={() => setShowProfileEdit(false)}>
          <div className="profile-edit-modal" onClick={e => e.stopPropagation()}>
            <div className="profile-edit-header">
              <button className="icon-btn" onClick={() => setShowProfileEdit(false)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              <span>Edit profile</span>
            </div>
            <div className="profile-edit-body">
              <div className="profile-edit-avatar" onClick={() => editPhotoRef.current?.click()}>
                {editPhotoPreview ? <img src={editPhotoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : <Avatar src={userProfile?.photo_url} size={100} name={userProfile?.display_name} />}
                <div className="profile-edit-avatar-overlay">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  <span>Change</span>
                </div>
                <input ref={editPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleEditPhoto} />
              </div>
              <div style={{ width: '100%' }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ color: '#00a884', fontSize: 13, display: 'block', marginBottom: 6 }}>Your name</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} maxLength={25} style={{ width: '100%', background: 'none', border: 'none', borderBottom: '2px solid #00a884', outline: 'none', color: '#e9edef', fontSize: 16, padding: '4px 0' }} />
                </div>
                <div>
                  <label style={{ color: '#00a884', fontSize: 13, display: 'block', marginBottom: 6 }}>About</label>
                  <textarea value={editAbout} onChange={e => setEditAbout(e.target.value)} maxLength={139} rows={2} style={{ width: '100%', background: 'none', border: 'none', borderBottom: '2px solid #00a884', outline: 'none', color: '#e9edef', fontSize: 15, resize: 'none', padding: '4px 0', fontFamily: 'inherit' }} />
                  <div style={{ textAlign: 'right', color: '#8696a0', fontSize: 12 }}>{editAbout.length}/139</div>
                </div>
              </div>
              <button className="btn-primary" onClick={handleSaveProfile} disabled={editLoading} style={{ alignSelf: 'center', marginTop: 8 }}>
                {editLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
