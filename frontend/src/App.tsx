import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import './App.css'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { AdminHomePage } from './pages/AdminHomePage'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      setLoading(false)
    }

    void loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return <div className="center-screen">Loading...</div>
  }

  const role =
    (session?.user.app_metadata.role as string | undefined) ??
    (session ? 'student' : undefined)

  return (
    <Routes>
        <Route
          path="/"
          element={
            <Navigate
              to={
                session
                  ? role === 'admin'
                    ? '/admin'
                    : '/home'
                  : '/login'
              }
              replace
            />
          }
        />
        <Route
          path="/login"
          element={
            session ? (
              <Navigate
                to={role === 'admin' ? '/admin' : '/home'}
                replace
              />
            ) : (
              <LoginPage />
            )
          }
        />
        <Route
          path="/signup"
          element={
            session ? (
              <Navigate
                to={role === 'admin' ? '/admin' : '/home'}
                replace
              />
            ) : (
              <SignupPage />
            )
          }
        />
        <Route
          path="/home"
          element={
            session ? (
              <HomePage session={session} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/admin/*"
          element={
            session && role === 'admin' ? (
              <AdminHomePage session={session} />
            ) : session ? (
              <Navigate to="/home" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
  )
}

export default App
