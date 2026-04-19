import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabase/config'

const API = import.meta.env.VITE_SERVER_URL || 'https://whatsapp-clone-server-pk4x.onrender.com'
const AuthContext = createContext()
export const useAuth = () => useContext(AuthContext)

// ── Client-side SHA-256 hash — NO server call, no hanging ─────────────────
// Replaces the old /hash-password endpoint which caused infinite "Creating..."
// on Render free tier cold starts. SHA-256 via Web Crypto is built into every
// modern browser and is instant.
async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Fetch with timeout so email send never blocks the UI ──────────────────
async function fetchWithTimeout(url, options, timeoutMs = 10000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timer)
    return res
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('wa_user')
    if (saved) {
      try {
        const user = JSON.parse(saved)
        supabase
          .from('users')
          .select('id, display_name, email, phone_number, photo_url, about, email_verified, online, last_seen')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data) { setCurrentUser(data); localStorage.setItem('wa_user', JSON.stringify(data)) }
            else localStorage.removeItem('wa_user')
          })
          .catch(() => {})
          .finally(() => setLoading(false))
      } catch (e) {
        localStorage.removeItem('wa_user')
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [])

  const signup = async ({ email, password, name, phoneNumber }) => {
    // 1. Check duplicate email
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle()
    if (existing) throw new Error('Email already registered. Try signing in.')

    // 2. Hash password client-side (instant — no server needed)
    const passwordHash = await hashPassword(password)

    // 3. Generate OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString()

    // 4. Insert user into Supabase
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        display_name: name,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        phone_number: phoneNumber || '',
        about: 'Hey there! I am using WhatsApp.',
        email_verified: false,
        verification_code: code,
        code_expiry: new Date(Date.now() + 600000).toISOString(),
        online: true,
        last_seen: new Date().toISOString(),
      })
      .select('id, display_name, email, phone_number, photo_url, about, email_verified')
      .single()

    if (error) throw new Error('Failed to create account. Please try again.')

    // 5. Save user immediately — don't wait for email
    setCurrentUser(user)
    localStorage.setItem('wa_user', JSON.stringify(user))

    // 6. Send OTP email in background (non-blocking, 10s timeout)
    fetchWithTimeout(`${API}/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_email: email, to_name: name, code }),
    }, 10000).catch(e => console.warn('Email send failed (non-fatal):', e.message))

    return user
  }

  const login = async (email, password) => {
    const passwordHash = await hashPassword(password)

    const { data: user, error } = await supabase
      .from('users')
      .select('id, display_name, email, phone_number, photo_url, about, email_verified')
      .eq('email', email.toLowerCase())
      .eq('password_hash', passwordHash)
      .single()

    if (error || !user) throw new Error('Invalid email or password.')

    await supabase
      .from('users')
      .update({ online: true, last_seen: new Date().toISOString() })
      .eq('id', user.id)

    setCurrentUser(user)
    localStorage.setItem('wa_user', JSON.stringify(user))
    return user
  }

  const forgotPassword = async (email) => {
    const { data: user } = await supabase
      .from('users')
      .select('id, display_name')
      .eq('email', email.toLowerCase())
      .maybeSingle()
    if (!user) throw new Error('No account found with that email.')

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    await supabase
      .from('users')
      .update({ verification_code: code, code_expiry: new Date(Date.now() + 600000).toISOString() })
      .eq('id', user.id)

    await fetchWithTimeout(`${API}/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_email: email, to_name: user.display_name, code }),
    }, 10000)

    return { email: email.toLowerCase(), userId: user.id }
  }

  const resetPassword = async (email, code, newPassword) => {
    const { data: user } = await supabase
      .from('users')
      .select('id, verification_code, code_expiry')
      .eq('email', email.toLowerCase())
      .maybeSingle()
    if (!user) throw new Error('User not found.')
    if (user.code_expiry && new Date() > new Date(user.code_expiry))
      throw new Error('Code expired. Request a new one.')
    if (user.verification_code !== code) throw new Error('Wrong code. Try again.')
    if (newPassword.length < 6) throw new Error('Password must be 6+ characters.')

    const passwordHash = await hashPassword(newPassword)
    await supabase
      .from('users')
      .update({ password_hash: passwordHash, verification_code: null, code_expiry: null })
      .eq('id', user.id)
  }

  const updateProfile = async ({ name, about, photoFile }) => {
    if (!currentUser?.id) return
    let photo_url = currentUser.photo_url

    if (photoFile) {
      const fp = `avatars/${currentUser.id}_${Date.now()}`
      const { error: ue } = await supabase.storage
        .from('chat-files')
        .upload(fp, photoFile, { upsert: true })
      if (ue) throw new Error('Failed to upload photo')
      const { data: u } = supabase.storage.from('chat-files').getPublicUrl(fp)
      photo_url = u.publicUrl
    }

    const updates = {}
    if (name && name !== currentUser.display_name) updates.display_name = name
    if (about !== undefined && about !== currentUser.about) updates.about = about
    if (photo_url !== currentUser.photo_url) updates.photo_url = photo_url
    if (Object.keys(updates).length === 0) return currentUser

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', currentUser.id)
      .select('id, display_name, email, phone_number, photo_url, about, email_verified')
      .single()

    if (error) throw new Error('Failed to update profile')
    setCurrentUser(data)
    localStorage.setItem('wa_user', JSON.stringify(data))
    return data
  }

  const refreshProfile = async () => {
    if (!currentUser?.id) return
    const { data } = await supabase
      .from('users')
      .select('id, display_name, email, phone_number, photo_url, about, email_verified')
      .eq('id', currentUser.id)
      .single()
    if (data) { setCurrentUser(data); localStorage.setItem('wa_user', JSON.stringify(data)) }
  }

  const logout = async () => {
    if (currentUser?.id) {
      await supabase
        .from('users')
        .update({ online: false, last_seen: new Date().toISOString() })
        .eq('id', currentUser.id)
    }
    setCurrentUser(null)
    localStorage.removeItem('wa_user')
  }

  return (
    <AuthContext.Provider value={{
      currentUser, loading, signup, login,
      forgotPassword, resetPassword, updateProfile, refreshProfile, logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
