import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import countries from '../data/countries'

function PasswordInput({ value, onChange, placeholder, onKeyDown, autoFocus }) {
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
        autoFocus={autoFocus}
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

// ── Forgot password flow ──────────────────────────────────────────────────────
function ForgotPassword({ onBack }) {
  const { forgotPassword, resetPassword } = useAuth()
  const { showToast } = useToast()
  const [step, setStep] = useState('email') // 'email' | 'code' | 'done'
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPass, setNewPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetMeta, setResetMeta] = useState(null)

  const handleSendCode = async () => {
    if (!email.trim()) { setError('Enter your email'); return }
    setLoading(true); setError('')
    try {
      const meta = await forgotPassword(email.trim())
      setResetMeta(meta)
      setStep('code')
      showToast('Reset code sent to your email!', 'success')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    if (!code || code.length < 6) { setError('Enter the 6-digit code'); return }
    if (!newPass || newPass.length < 6) { setError('Password must be 6+ characters'); return }
    setLoading(true); setError('')
    try {
      await resetPassword(resetMeta.email, code, newPass)
      setStep('done')
      showToast('Password reset! Sign in now.', 'success')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (step === 'done') return (
    <div style={{ textAlign: 'center', width: '100%', maxWidth: 340 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
      <h2 style={{ color: '#111b21', marginBottom: 8 }}>Password reset!</h2>
      <p style={{ color: '#667781', marginBottom: 24 }}>You can now sign in with your new password.</p>
      <button className="btn-primary" onClick={onBack}>Back to sign in</button>
    </div>
  )

  return (
    <div style={{ width: '100%', maxWidth: 340 }}>
      <button className="btn-link" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, fontSize: 13 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Back to sign in
      </button>
      <h2 style={{ color: '#111b21', fontSize: 18, marginBottom: 6, fontWeight: 500 }}>
        {step === 'email' ? 'Forgot password?' : 'Enter reset code'}
      </h2>
      <p style={{ color: '#667781', fontSize: 13, marginBottom: 24 }}>
        {step === 'email' ? 'Enter your email and we\'ll send a reset code.' : `Enter the 6-digit code sent to ${resetMeta?.email}`}
      </p>
      {step === 'email' && (
        <div className="form-group">
          <label>Email</label>
          <input type="email" className="form-input" placeholder="your@email.com" value={email} onChange={e => { setEmail(e.target.value); setError('') }} onKeyDown={e => e.key === 'Enter' && handleSendCode()} autoFocus />
        </div>
      )}
      {step === 'code' && (
        <>
          <div className="form-group">
            <label>Reset code</label>
            <input type="text" inputMode="numeric" className="form-input" placeholder="6-digit code" maxLength={6}
              value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError('') }} autoFocus />
          </div>
          <div className="form-group">
            <label>New password</label>
            <PasswordInput value={newPass} onChange={e => { setNewPass(e.target.value); setError('') }} placeholder="Min 6 characters" onKeyDown={e => e.key === 'Enter' && handleReset()} />
          </div>
        </>
      )}
      {error && <p className="error-text">{error}</p>}
      <button className="btn-primary" onClick={step === 'email' ? handleSendCode : handleReset} disabled={loading}>
        {loading ? 'Please wait...' : step === 'email' ? 'Send reset code' : 'Reset password'}
      </button>
    </div>
  )
}

export default function Login({ onPhoneSubmit }) {
  const { login } = useAuth()
  const { showToast } = useToast()
  const [tab, setTab] = useState('new')
  const [country, setCountry] = useState(countries[0])
  const [showDrop, setShowDrop] = useState(false)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForgot, setShowForgot] = useState(false)

  const handleNext = () => {
    if (!phone || phone.length < 6) { setError('Enter a valid phone number'); return }
    onPhoneSubmit(country.code + phone)
  }

  const handleSignIn = async () => {
    if (!email || !password) { setError('Enter email and password'); return }
    setLoading(true); setError('')
    try {
      await login(email.trim(), password)
      showToast('Welcome back!', 'success')
    } catch (e) {
      setError(e.message || 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  if (showForgot) return (
    <div className="wa-page">
      <header className="wa-header">
        <WaLogo />
        <span>WhatsApp</span>
      </header>
      <div className="wa-center">
        <div className="wa-card">
          <ForgotPassword onBack={() => setShowForgot(false)} />
        </div>
      </div>
    </div>
  )

  return (
    <div className="wa-page">
      <header className="wa-header">
        <WaLogo />
        <span>WhatsApp</span>
      </header>
      <div className="wa-center">
        <div className="wa-card">
          <h1>{tab === 'new' ? 'Enter phone number' : 'Welcome back'}</h1>
          <p className="subtitle">{tab === 'new' ? 'Select country and enter your phone number.' : 'Sign in with your email and password.'}</p>
          <div className="tabs">
            <button className={'tab' + (tab === 'new' ? ' active' : '')} onClick={() => { setTab('new'); setError('') }}>New account</button>
            <button className={'tab' + (tab === 'signin' ? ' active' : '')} onClick={() => { setTab('signin'); setError('') }}>Sign in</button>
          </div>
          {tab === 'new' ? (
            <>
              <div className="country-select">
                <button className={'country-btn' + (showDrop ? ' open' : '')} onClick={() => setShowDrop(!showDrop)} type="button">
                  <div className="left"><span style={{ fontSize: 20 }}>{country.flag}</span><span>{country.name}</span></div>
                  <span className="arrow">▼</span>
                </button>
                {showDrop && (<><div className="overlay" onClick={() => setShowDrop(false)} /><div className="country-dropdown">{countries.map(c => (<button key={c.name+c.code} className="country-option" onClick={() => { setCountry(c); setShowDrop(false) }}><span style={{ fontSize: 18 }}>{c.flag}</span><span>{c.name}</span><span className="code">{c.code}</span></button>))}</div></>)}
              </div>
              <div className="phone-row">
                <div className="phone-prefix">{country.code}</div>
                <input type="tel" className="phone-input" placeholder="Phone number" value={phone} onChange={e => { setPhone(e.target.value.replace(/\D/g, '')); setError('') }} onKeyDown={e => e.key === 'Enter' && handleNext()} autoFocus />
              </div>
              {error && <p className="error-text">{error}</p>}
              <button className="btn-primary" onClick={handleNext} disabled={!phone}>Next</button>
            </>
          ) : (
            <>
              <div className="form-group">
                <label>Email</label>
                <input type="email" className="form-input" placeholder="your@email.com" value={email} onChange={e => { setEmail(e.target.value); setError('') }} onKeyDown={e => e.key === 'Enter' && handleSignIn()} autoFocus />
              </div>
              <div className="form-group">
                <label>Password</label>
                <PasswordInput value={password} onChange={e => { setPassword(e.target.value); setError('') }} placeholder="Enter password" onKeyDown={e => e.key === 'Enter' && handleSignIn()} />
              </div>
              <div style={{ width: '100%', maxWidth: 340, textAlign: 'right', marginBottom: 8, marginTop: -8 }}>
                <button className="btn-link" style={{ fontSize: 13 }} onClick={() => setShowForgot(true)}>Forgot password?</button>
              </div>
              {error && <p className="error-text">{error}</p>}
              <button className="btn-primary" onClick={handleSignIn} disabled={loading || !email || !password} style={{ marginTop: 8 }}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </>
          )}
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
