import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import ProfileSetup from './pages/ProfileSetup'
import Chat from './pages/Chat'

export default function App() {
  const { currentUser, loading } = useAuth()
  const [phoneNumber, setPhoneNumber] = useState(null)

  if (loading) return (
    <div className="loading-page">
      <div className="spinner" />
      <svg viewBox="0 0 39 39" width="40" height="40">
        <path fill="#00a884" d="M10.7 32.8l.6.3c2.5 1.5 5.3 2.2 8.1 2.2 8.8 0 16-7.2 16-16 0-4.2-1.7-8.3-4.7-11.3s-7-4.7-11.3-4.7c-8.8 0-16 7.2-15.9 16.1 0 3 .9 5.9 2.4 8.4l.4.6-1.5 5.5 5.9-1.1z"/>
      </svg>
    </div>
  )

  if (!currentUser && !phoneNumber) return <Login onPhoneSubmit={p => setPhoneNumber(p)} />
  if (!currentUser && phoneNumber) return <ProfileSetup phoneNumber={phoneNumber} onComplete={() => {}} />
  if (currentUser) return <Chat />
  return null
}
