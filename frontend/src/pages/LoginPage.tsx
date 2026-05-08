import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    navigate('/home', { replace: true })
  }

  return (
    <main className="login-split">
      {/* Left — animated gradient */}
      <div className="login-left">
        <div className="login-gradient-orb login-orb-1" />
        <div className="login-gradient-orb login-orb-2" />
        <div className="login-gradient-orb login-orb-3" />
      </div>

      {/* Right — form */}
      <div className="login-right">
        <div className="login-form-wrap">
          <img src="/sit-logo.png" alt="SIT" className="login-logo" />
          <h2 className="login-heading">Welcome back</h2>
          <p className="login-subheading">Sign in to your account</p>

          {/* Google login button */}
          <button
            type="button"
            className="login-google-btn"
            onClick={async () => {
              await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: `${window.location.origin}/home` },
              })
            }}
          >
            <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
            Login with Google
          </button>

          <div className="login-divider">
            <span className="login-divider-line" />
            <span className="login-divider-text">or</span>
            <span className="login-divider-line" />
          </div>

          <form onSubmit={onSubmit} className="login-form">
            <div className="login-field">
              <label htmlFor="login-email">Email <span className="login-req">*</span></label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="login-pw">Password <span className="login-req">*</span></label>
              <div className="login-pw-wrap">
                <input
                  id="login-pw"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <button type="button" className="login-pw-toggle" onClick={() => setShowPw(!showPw)}>
                  {showPw ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
            </div>

            {error && <p className="login-error">{error}</p>}

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'} &rarr;
            </button>

            <div className="login-bottom-row">
              <Link to="/forgot-password" className="login-forgot">Forgot password?</Link>
              <span className="login-signup-text">New user? <Link to="/signup" className="login-signup-link">Create an account</Link></span>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
