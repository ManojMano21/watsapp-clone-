import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

function getStrength(pw) {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 6) score++
  if (pw.length >= 10) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

function StrengthBar({ password }) {
  const s = getStrength(password)
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong']
  const colors = ['', '#ea0038', '#f0ad4e', '#5bc0de', '#00a884', '#00a884']
  if (!password) return null
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= s ? colors[s] : '#e0dcd5', transition: 'background 0.3s' }} />
        ))}
      </div>
      <p style={{ color: colors[s], fontSize: 12 }}>{labels[s]}</p>
    </div>
  )
}

function PasswordInput({ value, onChange, placeholder, onKeyDown }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        className="form-input"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        style={{ paddingRight: 44 }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8696a0', padding: 4 }}
      >
        {show ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        )}
      </button>
    </div>
  )
}

export default function ProfileSetup({ phoneNumber, onComplete }) {
  const { signup } = useAuth()
  const { showToast } = useToast()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const handlePhoto = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { setError('Image must be under 5MB'); return }
    setPhoto(f); setPreview(URL.createObjectURL(f)); setError('')
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Enter your name'); return }
    if (!password || password.length < 6) { setError('Password must be 6+ characters'); return }
    setLoading(true); setError('')
    try {
      await signup({ password, name: name.trim(), phoneNumber })
      showToast('Account created! You can now sign in.', 'success', 5000)
      onComplete()
    } catch (e) {
      setError(e.message || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
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
          <h1>Profile info</h1>
          <p className="subtitle">Enter your name and create a password</p>

          <div className={'avatar-upload' + (preview ? ' has-photo' : '')} onClick={() => fileRef.current?.click()}>
            {preview ? <img src={preview} alt="" /> : (
              <div className="avatar-placeholder">
                <svg viewBox="0 0 212 212" width="140" height="140">
                  <path fill="#dfe5e7" d="M106.251.5C164.653.5 212 47.846 212 106.25S164.653 212 106.25 212C47.846 212 .5 164.654.5 106.25S47.846.5 106.251.5z"/>
                  <path fill="#fff" d="M173.561 171.615a62.767 62.767 0 0 0-2.065-2.955 67.7 67.7 0 0 0-2.608-3.299 70.112 70.112 0 0 0-3.184-3.527 71.097 71.097 0 0 0-5.924-5.47 72.458 72.458 0 0 0-10.204-7.026 75.2 75.2 0 0 0-5.98-3.055c-.062-.028-.118-.059-.18-.087-9.792-4.44-22.106-7.529-37.416-7.529s-27.624 3.089-37.416 7.529c-.338.153-.653.318-.985.474a75.37 75.37 0 0 0-6.229 3.298 72.589 72.589 0 0 0-9.15 6.395 71.243 71.243 0 0 0-5.924 5.47 70.064 70.064 0 0 0-3.184 3.527 67.142 67.142 0 0 0-2.609 3.299 63.292 63.292 0 0 0-2.065 2.955 56.33 56.33 0 0 0-1.447 2.324c-.033.056-.073.119-.104.174a47.92 47.92 0 0 0-1.07 1.926c-.559 1.068-.818 1.678-.818 1.678v.398c18.285 17.927 43.322 28.985 70.945 28.985 27.623 0 52.661-11.058 70.945-28.985v-.398s-.259-.61-.818-1.678a49.872 49.872 0 0 0-1.07-1.926c-.034-.055-.073-.118-.104-.174a56.118 56.118 0 0 0-1.447-2.324zM106.002 125.5c2.645 0 5.212-.253 7.68-.737a38.272 38.272 0 0 0 3.624-.896 37.124 37.124 0 0 0 5.12-1.958 36.307 36.307 0 0 0 6.15-3.67 35.923 35.923 0 0 0 9.489-10.48 36.558 36.558 0 0 0 2.422-4.84 37.051 37.051 0 0 0 1.716-5.25c.299-1.208.542-2.443.725-3.701.275-1.887.417-3.827.417-5.811s-.142-3.925-.417-5.811a38.734 38.734 0 0 0-.725-3.701 37.054 37.054 0 0 0-1.716-5.25 36.694 36.694 0 0 0-2.422-4.84 35.917 35.917 0 0 0-9.489-10.48 36.347 36.347 0 0 0-6.15-3.67 37.124 37.124 0 0 0-5.12-1.958 37.67 37.67 0 0 0-3.624-.896 39.875 39.875 0 0 0-7.68-.737c-21.162 0-37.345 16.183-37.345 37.345 0 21.159 16.183 37.342 37.345 37.342z"/>
                </svg>
              </div>
            )}
            <div className="avatar-overlay">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <span>{preview ? 'Change' : 'Add photo'}</span>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
          </div>

          <div className="form-group">
            <label>Your name</label>
            <input type="text" className="form-input" placeholder="Enter your name" value={name} onChange={e => { setName(e.target.value); setError('') }} maxLength={25} autoFocus />
            <div className="char-count">{name.length}/25</div>
          </div>
          <div className="form-group">
            <label>Create password</label>
            <PasswordInput value={password} onChange={e => { setPassword(e.target.value); setError('') }} placeholder="Min 6 characters" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            <StrengthBar password={password} />
          </div>

          <div style={{ width: '100%', maxWidth: 340, marginBottom: 20 }}>
            <p style={{ color: '#667781', fontSize: 13 }}>Phone: <strong style={{ color: '#111b21' }}>{phoneNumber}</strong> <button className="btn-link" style={{ fontSize: 12 }} onClick={() => window.location.reload()}>Change</button></p>
          </div>

          {error && <p className="error-text">{error}</p>}
          <button className="btn-primary" onClick={handleSubmit} disabled={loading || !name.trim() || !password}>
            {loading ? 'Creating...' : 'Continue'}
          </button>
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
