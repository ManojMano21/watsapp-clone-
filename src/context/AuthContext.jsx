import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabase/config'

const AuthContext = createContext()
export const useAuth = () => useContext(AuthContext)

// ── Client-side SHA-256 hash ──────────────────────────────────────────────────
async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
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
          .select('id, display_name, phone_number, photo_url, about, online, last_seen')
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

  const signup = async ({ password, name, phoneNumber }) => {
    if (!phoneNumber) throw new Error('Phone number is required.')

    // 1. Check duplicate phone
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', phoneNumber)
      .maybeSingle()
    if (existing) throw new Error('Phone number already registered. Try signing in.')

    // 2. Hash password client-side
    const passwordHash = await hashPassword(password)

    // 3. Insert user into Supabase
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        display_name: name,
        phone_number: phoneNumber,
        password_hash: passwordHash,
        about: 'Hey there! I am using WhatsApp.',
        online: true,
        last_seen: new Date().toISOString(),
      })
      .select('id, display_name, phone_number, photo_url, about')
      .single()

    if (error) throw new Error('Failed to create account. Please try again.')

    setCurrentUser(user)
    localStorage.setItem('wa_user', JSON.stringify(user))
    return user
  }

  const login = async (phoneNumber, password) => {
    const passwordHash = await hashPassword(password)

    const { data: user, error } = await supabase
      .from('users')
      .select('id, display_name, phone_number, photo_url, about')
      .eq('phone_number', phoneNumber)
      .eq('password_hash', passwordHash)
      .single()

    if (error || !user) throw new Error('Invalid phone number or password.')

    await supabase
      .from('users')
      .update({ online: true, last_seen: new Date().toISOString() })
      .eq('id', user.id)

    setCurrentUser(user)
    localStorage.setItem('wa_user', JSON.stringify(user))
    return user
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
      .select('id, display_name, phone_number, photo_url, about')
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
      .select('id, display_name, phone_number, photo_url, about')
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
      updateProfile, refreshProfile, logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
