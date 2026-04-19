# WhatsApp Clone — Supabase Edition

A full-featured WhatsApp Web clone built with **React + Supabase** (migrated from Firebase).

## Features
- 📱 Phone number + email signup with custom OTP via SMTP
- 💬 Real-time messaging (Supabase Realtime + Socket.IO)
- 📎 File & image sharing (Supabase Storage)
- 🟢 Online status & typing indicators (Socket.IO)
- ✓✓ Read receipts
- 📱 Mobile responsive
- 🔒 Row Level Security (RLS) on all tables

---

## Setup Guide

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Note your **Project URL** and **anon public key** from Settings → API

### 2. Run Database Setup

1. Go to **SQL Editor** in your Supabase dashboard
2. Paste the entire contents of `supabase-setup.sql`
3. Click **Run** — this creates all tables, indexes, RLS policies, storage buckets, and enables Realtime

### 3. Configure Supabase Auth

1. Go to **Authentication → Settings**
2. Under **Email Auth**, ensure "Enable Email Signup" is ON
3. **IMPORTANT**: Toggle OFF "Confirm email" (we handle verification ourselves via SMTP OTP)
4. Under **Auth → URL Configuration**, no redirect URL needed

### 4. Configure Supabase Realtime

1. Go to **Database → Replication**  
2. Ensure these tables have Realtime enabled: `messages`, `chats`, `chat_participants`, `users`
3. The SQL script already enables this, but verify in the dashboard

### 5. Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

SMTP_EMAIL=your.email@gmail.com
SMTP_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

**Gmail App Password**: Google Account → Security → 2-Step Verification → App Passwords → Generate

### 6. Install & Run

```bash
npm install

# Terminal 1: Start backend (SMTP + Socket.IO)
npm run server

# Terminal 2: Start frontend (Vite)
npm run dev
```

Open `http://localhost:5173`

---

## Architecture Changes from Firebase

| Feature | Firebase | Supabase |
|---------|----------|----------|
| Auth | `firebase/auth` | `supabase.auth` |
| Database | Firestore (NoSQL) | PostgreSQL (SQL) |
| Storage | Firebase Storage | Supabase Storage |
| Realtime | Firestore `onSnapshot` | Supabase Realtime channels |
| Security | Firestore Rules | Row Level Security (RLS) |
| User ID | `user.uid` | `user.id` |
| Timestamps | `serverTimestamp()` | ISO strings / `NOW()` |
| Field names | camelCase | snake_case |

### Key Field Name Changes
- `displayName` → `display_name`
- `photoURL` → `photo_url`
- `phoneNumber` → `phone_number`
- `emailVerified` → `email_verified`
- `verificationCode` → `verification_code`
- `codeExpiry` → `code_expiry`
- `lastSeen` → `last_seen`
- `senderId` → `sender_id`
- `fileURL` → `file_url`
- `fileName` → `file_name`
- `fileSize` → `file_size`
- `timestamp` → `created_at`

---

## Database Schema

```
users
├── id (UUID, PK, FK → auth.users)
├── display_name, email, phone_number
├── photo_url, about
├── email_verified, verification_code, code_expiry
├── online, last_seen, created_at

chats
├── id (TEXT, PK — format: "uid1_uid2" sorted)
├── last_message_text, last_message_sender
├── last_message_type, last_message_at
├── created_at, updated_at

chat_participants
├── id (BIGSERIAL, PK)
├── chat_id (FK → chats), user_id (FK → users)
├── joined_at

messages
├── id (UUID, PK)
├── chat_id (FK → chats), sender_id (FK → users)
├── text, type (text/image/document)
├── file_url, file_name, file_size
├── read, created_at
```

---

## Classroom Mode

Students on the same WiFi can join by visiting:
```
http://YOUR_LOCAL_IP:5173
```

The server auto-detects and prints the IP on startup.
