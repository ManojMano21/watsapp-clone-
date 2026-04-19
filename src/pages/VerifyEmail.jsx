import { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

// ✅ FIX: use the same env var as AuthContext — not hardcoded localhost:3001
const API = import.meta.env.VITE_SERVER_URL || 'https://whatsapp-clone-server-pk4x.onrender.com'
async function fetchWithTimeout(url, options, ms = 10000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try { const r = await fetch(url, { ...options, signal: ctrl.signal }); clearTimeout(t); return r }
  catch (e) { clearTimeout(t); throw e }
}

const RESEND_COOLDOWN = 60 // seconds

export default function VerifyEmail({ onVerified, onSkip }) {
  const { currentUser, logout } = useAuth()
  const { showToast } = useToast()
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0) // resend cooldown
  const refs = useRef([])
  const countdownRef = useRef(null)

  // Start countdown on mount so user knows to wait before resending
  useEffect(() => {
    startCountdown()
    return () => clearInterval(countdownRef.current)
  }, [])

  const startCountdown = () => {
    setCountdown(RESEND_COOLDOWN)
    clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(countdownRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const handleChange = (i, val) => {
    if (val.length > 1) val = val[val.length - 1]
    if (!/^\d*$/.test(val)) return
    const n = [...otp]; n[i] = val; setOtp(n); setError('')
    if (val && i < 5) refs.current[i + 1]?.focus()
    if (n.every(d => d)) verify(n.join(''))
  }

  const handleKey = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) refs.current[i - 1]?.focus()
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const n = [...otp]; p.split('').forEach((c, i) => { n[i] = c }); setOtp(n)
    if (p.length === 6) verify(p)
  }

  const verify = async (code) => {
    setLoading(true); setError('')
    try {
      const { data, error: fetchErr } = await supabase
        .from('users')
        .select('verification_code, code_expiry')
        .eq('id', currentUser.id)
        .single()

      if (fetchErr || !data) { setError('User not found'); return }

      if (data.code_expiry && new Date() > new Date(data.code_expiry)) {
        setError('Code expired. Click Resend.')
        setOtp(['', '', '', '', '', '']); refs.current[0]?.focus(); return
      }

      if (data.verification_code === code) {
        await supabase
          .from('users')
          .update({ email_verified: true, verification_code: null, code_expiry: null })
          .eq('id', currentUser.id)
        showToast('Email verified!', 'success')
        onVerified()
      } else {
        setError('Wrong code. Try again.')
        setOtp(['', '', '', '', '', '']); refs.current[0]?.focus()
      }
    } catch (e) {
      setError('Failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    if (countdown > 0) return
    setError('')
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      await supabase
        .from('users')
        .update({ verification_code: code, code_expiry: new Date(Date.now() + 600000).toISOString() })
        .eq('id', currentUser.id)

      await fetchWithTimeout(`${API}/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_email: currentUser.email, to_name: currentUser.display_name, code }),
      })

      showToast('New code sent!', 'success')
      setOtp(['', '', '', '', '', '']); refs.current[0]?.focus()
      startCountdown()
    } catch (e) {
      showToast('Failed to resend. Try again.', 'error')
    }
  }

  return (
    <div className="wa-page">
      <header className="wa-header">
        <WaLogo />
        <span>WhatsApp</span>
      </header>
      <div className="wa-center">
        <div className="wa-card">
          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
          <h1>Enter verification code</h1>
          <p className="subtitle" style={{ marginBottom: 8 }}>We sent a 6-digit code to</p>
          <p style={{ color: '#111b21', fontWeight: 600, fontSize: 15, marginBottom: 32 }}>{currentUser?.email}</p>

          <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
            {otp.map((d, i) => (
              <input
                key={i}
                ref={el => refs.current[i] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKey(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                autoFocus={i === 0}
                style={{
                  width: 44, height: 52, textAlign: 'center', fontSize: 22,
                  fontWeight: 500, color: '#111b21',
                  border: '1px solid ' + (d ? '#00a884' : '#d1d5d8'),
                  borderRadius: 10, outline: 'none', transition: 'border-color 0.15s'
                }}
                onFocus={e => e.target.style.borderColor = '#00a884'}
                onBlur={e => { if (!d) e.target.style.borderColor = '#d1d5d8' }}
              />
            ))}
          </div>

          {error && <p className="error-text">{error}</p>}
          {loading && <p style={{ color: '#00a884', fontSize: 14, marginBottom: 16 }}>Verifying...</p>}

          {/* Resend with countdown */}
          <button
            className="btn-link"
            onClick={resend}
            disabled={countdown > 0}
            style={{ marginBottom: 8, opacity: countdown > 0 ? 0.5 : 1, cursor: countdown > 0 ? 'default' : 'pointer' }}
          >
            {countdown > 0 ? `Resend in ${countdown}s` : "Didn't receive? Resend"}
          </button>

          <p style={{ color: '#8696a0', fontSize: 12, marginBottom: 24 }}>Code expires in 10 minutes. Check spam too.</p>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn-skip" onClick={onSkip}>Skip for now</button>
            <button className="btn-link" style={{ color: '#ea0038', fontSize: 13 }} onClick={logout}>Different account</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function WaLogo() {
  return (
    <svg viewBox="0 0 39 39" width="28" height="28">
      <path fill="#00a884" d="M10.7 32.8l.6.3c2.5 1.5 5.3 2.2 8.1 2.2 8.8 0 16-7.2 16-16 0-4.2-1.7-8.3-4.7-11.3s-7-4.7-11.3-4.7c-8.8 0-16 7.2-15.9 16.1 0 3 .9 5.9 2.4 8.4l.4.6-1.5 5.5 5.9-1.1z"/>
      <path fill="#00a884" d="M32.4 6.4C29 2.9 24.3 1 19.5 1 9.3 1 1.1 9.3 1.2 19.4c0 3.2.9 6.3 2.4 9.1L1 38l9.7-2.5c2.7 1.5 5.7 2.2 8.7 2.2 10.1 0 18.3-8.3 18.3-18.4 0-4.9-1.9-9.5-5.3-12.9zM19.5 34.6c-2.7 0-5.4-.7-7.7-2.1l-.6-.3-5.8 1.5L6.9 28l-.4-.6c-4.4-7.1-2.3-16.5 4.9-20.9s16.5-2.3 20.9 4.9 2.3 16.5-4.9 20.9c-2.3 1.5-5.1 2.3-7.9 2.3z"/>
    </svg>
  )
}
