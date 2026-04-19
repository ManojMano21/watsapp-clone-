import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || `http://${window.location.hostname}:3001`

export function useSocket(user) {
  const socketRef = useRef(null)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [typingUsers, setTypingUsers] = useState({})

  const [incomingCall, setIncomingCall] = useState(null)
  const [callAccepted, setCallAccepted] = useState(false)
  const [callRejected, setCallRejected] = useState(false)
  const [callUnavailable, setCallUnavailable] = useState(false)
  const [callEnded, setCallEnded] = useState(false)
  const [remoteOffer, setRemoteOffer] = useState(null)
  const [remoteAnswer, setRemoteAnswer] = useState(null)

  // ICE candidates use a CALLBACK REF instead of useState
  // This prevents React 18 batching from dropping rapid-fire candidates
  const onIceCandidateRef = useRef(null)
  // Buffer for ICE candidates that arrive before handler is registered
  const iceCandidateBuffer = useRef([])

  useEffect(() => {
    if (!user?.id) return

    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id)
      socket.emit('user:online', {
        uid: user.id,
        displayName: user.display_name,
        photoURL: user.photo_url,
      })
    })

    socket.on('users:online', (uids) => setOnlineUsers(uids))
    socket.on('typing:show', ({ uid, displayName }) => {
      setTypingUsers(prev => ({ ...prev, [uid]: displayName }))
    })
    socket.on('typing:hide', ({ uid }) => {
      setTypingUsers(prev => { const n = { ...prev }; delete n[uid]; return n })
    })

    socket.on('call:incoming', (data) => {
      console.log('Incoming call from:', data.callerName)
      setIncomingCall(data)
    })
    socket.on('call:accepted', () => {
      console.log('Call accepted by recipient')
      setCallAccepted(true)
    })
    socket.on('call:rejected', () => {
      console.log('Call rejected')
      setCallRejected(true)
    })
    socket.on('call:unavailable', () => {
      console.log('Recipient unavailable')
      setCallUnavailable(true)
    })
    socket.on('call:ended', () => {
      console.log('Call ended by remote')
      setCallEnded(true)
    })
    socket.on('call:offer', ({ callerId, offer }) => {
      console.log('Received WebRTC offer from:', callerId)
      setRemoteOffer({ callerId, offer })
    })
    socket.on('call:answer', ({ responderId, answer }) => {
      console.log('Received WebRTC answer from:', responderId)
      setRemoteAnswer({ responderId, answer })
    })

    // ICE candidates go directly to callback - bypasses React state entirely
    socket.on('call:ice-candidate', ({ senderId, candidate }) => {
      console.log('ICE candidate received from:', senderId)
      if (onIceCandidateRef.current) {
        onIceCandidateRef.current(candidate)
      } else {
        // Buffer it for when the handler gets registered
        console.log('Buffering ICE candidate (no handler yet)')
        iceCandidateBuffer.current.push(candidate)
      }
    })

    socket.on('disconnect', () => { console.log('Socket disconnected') })

    return () => { socket.disconnect() }
  }, [user?.id, user?.display_name, user?.photo_url])

  const joinChat = useCallback((chatId) => { socketRef.current?.emit('chat:join', chatId) }, [])
  const sendMessage = useCallback((data) => { socketRef.current?.emit('message:send', data) }, [])
  const startTyping = useCallback((chatId, uid, displayName) => { socketRef.current?.emit('typing:start', { chatId, uid, displayName }) }, [])
  const stopTyping = useCallback((chatId, uid) => { socketRef.current?.emit('typing:stop', { chatId, uid }) }, [])
  const markRead = useCallback((chatId, messageId, readBy) => { socketRef.current?.emit('message:read', { chatId, messageId, readBy }) }, [])
  const onMessage = useCallback((cb) => { socketRef.current?.on('message:receive', cb); return () => socketRef.current?.off('message:receive', cb) }, [])
  const onNewChat = useCallback((cb) => { socketRef.current?.on('message:new', cb); return () => socketRef.current?.off('message:new', cb) }, [])

  const initiateCall = useCallback(({ callerId, callerName, callerPhoto, recipientId, callType }) => {
    console.log('Emitting call:initiate to', recipientId)
    socketRef.current?.emit('call:initiate', { callerId, callerName, callerPhoto, recipientId, callType })
  }, [])
  const acceptCall = useCallback(({ callerId, recipientId }) => {
    console.log('Emitting call:accept for', callerId)
    socketRef.current?.emit('call:accept', { callerId, recipientId })
    setIncomingCall(null)
  }, [])
  const rejectCall = useCallback(({ callerId, recipientId }) => {
    console.log('Emitting call:reject for', callerId)
    socketRef.current?.emit('call:reject', { callerId, recipientId })
    setIncomingCall(null)
  }, [])
  const sendOffer = useCallback(({ targetId, offer }) => {
    console.log('Sending WebRTC offer to', targetId)
    socketRef.current?.emit('call:offer', { targetId, offer })
  }, [])
  const sendAnswer = useCallback(({ targetId, answer }) => {
    console.log('Sending WebRTC answer to', targetId)
    socketRef.current?.emit('call:answer', { targetId, answer })
  }, [])
  const sendIceCandidate = useCallback(({ targetId, candidate }) => {
    socketRef.current?.emit('call:ice-candidate', { targetId, candidate })
  }, [])
  const endCall = useCallback(({ targetId }) => {
    console.log('Ending call with', targetId)
    socketRef.current?.emit('call:end', { targetId })
  }, [])

  // Register a callback to handle ICE candidates directly (bypasses React state)
  // Also drains any buffered candidates that arrived before handler was registered
  const registerIceCandidateHandler = useCallback((handler) => {
    onIceCandidateRef.current = handler
    // Drain buffered candidates
    if (handler && iceCandidateBuffer.current.length > 0) {
      console.log(`Draining ${iceCandidateBuffer.current.length} buffered ICE candidates`)
      const buffered = [...iceCandidateBuffer.current]
      iceCandidateBuffer.current = []
      buffered.forEach(c => handler(c))
    }
  }, [])

  const resetCallState = useCallback(() => {
    setIncomingCall(null); setCallAccepted(false); setCallRejected(false)
    setCallUnavailable(false); setCallEnded(false)
    setRemoteOffer(null); setRemoteAnswer(null)
    onIceCandidateRef.current = null
    iceCandidateBuffer.current = []
  }, [])

  return {
    socket: socketRef.current, onlineUsers, typingUsers,
    joinChat, sendMessage, startTyping, stopTyping, markRead, onMessage, onNewChat,
    incomingCall, callAccepted, callRejected, callUnavailable, callEnded,
    remoteOffer, remoteAnswer,
    initiateCall, acceptCall, rejectCall,
    sendOffer, sendAnswer, sendIceCandidate, endCall,
    registerIceCandidateHandler, resetCallState,
  }
}
