import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import nodemailer from 'nodemailer'
import crypto from 'crypto'
import dotenv from 'dotenv'
import os from 'os'

dotenv.config()

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
})

app.use(cors({
  origin: [
    "https://whatsapp-clone-m9k3.vercel.app",
    "https://whatsapp-clone-m9k3-git-main-emmanuel-s-projects-92444f39.vercel.app",
    "https://whatsapp-clone-m9k3-j30mf9sg4-emmanuel-s-projects-92444f39.vercel.app"
  ],
  credentials: true
}));
app.use(express.json())

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.SMTP_EMAIL, pass: process.env.SMTP_APP_PASSWORD },
})

app.post('/hash-password', (req, res) => {
  const { password } = req.body
  if (!password) return res.status(400).json({ error: 'Password required' })
  const hash = crypto.createHash('sha256').update(password).digest('hex')
  res.json({ hash })
})

app.post('/send-code', async (req, res) => {
  const { to_email, to_name, code } = req.body
  if (!to_email || !code) return res.status(400).json({ error: 'Missing email or code' })
  try {
    await transporter.sendMail({
      from: `"WhatsApp Clone" <${process.env.SMTP_EMAIL}>`,
      to: to_email,
      subject: 'Your WhatsApp Verification Code',
      html: `<div style="font-family:Arial;text-align:center;padding:32px">
        <h2>Verification Code</h2>
        <p>Hi ${to_name || 'there'},</p>
        <div style="background:#00a884;color:#fff;font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 32px;border-radius:12px;display:inline-block">${code}</div>
        <p style="color:#888;margin-top:16px">Expires in 10 minutes</p>
      </div>`,
    })
    console.log(`Code sent to ${to_email}`)
    res.json({ success: true })
  } catch (err) {
    console.error('Email error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.get('/health', (req, res) => res.json({ status: 'ok' }))

// ========== SOCKET.IO ==========
const onlineUsers = new Map()

io.on('connection', (socket) => {
  console.log('Connected:', socket.id)

  socket.on('user:online', (userData) => {
    onlineUsers.set(userData.uid, { socketId: socket.id, ...userData })
    socket.uid = userData.uid
    io.emit('users:online', Array.from(onlineUsers.keys()))
  })

  socket.on('chat:join', (chatId) => { socket.join(chatId) })

  socket.on('message:send', (data) => {
    io.to(data.chatId).emit('message:receive', data)
    const recipient = onlineUsers.get(data.recipientId)
    if (recipient) {
      io.to(recipient.socketId).emit('message:new', { chatId: data.chatId, message: data })
    }
  })

  socket.on('typing:start', ({ chatId, uid, displayName }) => {
    socket.to(chatId).emit('typing:show', { uid, displayName })
  })
  socket.on('typing:stop', ({ chatId, uid }) => {
    socket.to(chatId).emit('typing:hide', { uid })
  })
  socket.on('message:read', ({ chatId, messageId, readBy }) => {
    socket.to(chatId).emit('message:read', { messageId, readBy })
  })

  // ========== CALL SIGNALING ==========
  socket.on('call:initiate', ({ callerId, callerName, callerPhoto, recipientId, callType }) => {
    console.log(`Call: ${callerName} -> ${recipientId} (${callType})`)
    const recipient = onlineUsers.get(recipientId)
    if (recipient) {
      io.to(recipient.socketId).emit('call:incoming', { callerId, callerName, callerPhoto, callType })
    } else {
      socket.emit('call:unavailable', { recipientId })
    }
  })

  socket.on('call:accept', ({ callerId, recipientId }) => {
    const caller = onlineUsers.get(callerId)
    if (caller) io.to(caller.socketId).emit('call:accepted', { recipientId })
  })

  socket.on('call:reject', ({ callerId, recipientId }) => {
    const caller = onlineUsers.get(callerId)
    if (caller) io.to(caller.socketId).emit('call:rejected', { recipientId })
  })

  socket.on('call:offer', ({ targetId, offer }) => {
    const target = onlineUsers.get(targetId)
    if (target) io.to(target.socketId).emit('call:offer', { callerId: socket.uid, offer })
  })

  socket.on('call:answer', ({ targetId, answer }) => {
    const target = onlineUsers.get(targetId)
    if (target) io.to(target.socketId).emit('call:answer', { responderId: socket.uid, answer })
  })

  socket.on('call:ice-candidate', ({ targetId, candidate }) => {
    const target = onlineUsers.get(targetId)
    if (target) io.to(target.socketId).emit('call:ice-candidate', { senderId: socket.uid, candidate })
  })

  socket.on('call:end', ({ targetId }) => {
    const target = onlineUsers.get(targetId)
    if (target) io.to(target.socketId).emit('call:ended', { endedBy: socket.uid })
  })

  socket.on('disconnect', () => {
    if (socket.uid) {
      onlineUsers.delete(socket.uid)
      io.emit('users:online', Array.from(onlineUsers.keys()))
    }
  })
})

function getLocalIP() {
  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return 'localhost'
}

const PORT = process.env.PORT || 3001
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server: http://localhost:${PORT}`)
  console.log(`SMTP: ${process.env.SMTP_EMAIL}`)
  console.log(`Frontend: http://${getLocalIP()}:5173`)
})
