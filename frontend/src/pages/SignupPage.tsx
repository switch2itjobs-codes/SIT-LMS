import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ChevronRight, ChevronLeft, Upload, Check, User, Briefcase, Link2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getBackendOrigin } from '../lib/backendOrigin'

const DEGREE_OPTIONS = ['MBA', 'ME/ MTech', 'BE/ BTech', 'BBA', 'BCom', 'BSc', "master's_degree", 'diploma', "bachelor's_degree", 'other']
const DOMAIN_OPTIONS = ['Sales', 'Operations', 'Banking', 'Finance', "BPO's", 'Healthcare', 'Fresher', 'Teacher', 'Developer', 'Testing', 'HR Recruiters', 'Digital Marketing', 'Engineers', 'Support']
const GENDER_OPTIONS = ['Male', 'Female', 'Other']

export function SignupPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showPw, setShowPw] = useState(false)

  // Step 1 — Basic Details
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [gender, setGender] = useState('')
  const [city, setCity] = useState('')

  // Step 2 — Education & Professional
  const [degree, setDegree] = useState('')
  const [prevCompany, setPrevCompany] = useState('')
  const [prevRole, setPrevRole] = useState('')
  const [experience, setExperience] = useState('')
  const [domain, setDomain] = useState('')

  // Step 3 — Profile Links (optional)
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [naukriUrl, setNaukriUrl] = useState('')
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const resumeRef = useRef<HTMLInputElement>(null)
  const avatarRef = useRef<HTMLInputElement>(null)

  const validateStep1 = () => {
    if (!fullName.trim()) return 'Full Name is required'
    if (!email.trim()) return 'Email is required'
    if (!/\S+@\S+\.\S+/.test(email)) return 'Invalid email address'
    if (!phone.trim()) return 'Phone is required'
    const digits = phone.replace(/[^0-9]/g, '')
    if (digits.length !== 10) return 'Phone must be exactly 10 digits'
    if (!password) return 'Password is required'
    if (password.length < 6) return 'Password must be at least 6 characters'
    if (!gender) return 'Gender is required'
    if (!city.trim()) return 'City is required'
    return ''
  }

  const validateStep2 = () => {
    if (!degree) return 'Degree is required'
    if (!prevRole.trim()) return 'Previous Role is required'
    if (!domain) return 'Domain is required'
    return ''
  }

  const goNext = () => {
    setError('')
    if (step === 1) {
      const err = validateStep1()
      if (err) { setError(err); return }
    }
    if (step === 2) {
      const err = validateStep2()
      if (err) { setError(err); return }
    }
    setStep(step + 1)
  }

  const goBack = () => {
    setError('')
    setStep(step - 1)
  }

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPG, PNG, or WebP images.'); return
    }
    if (file.size > 2 * 1024 * 1024) { setError('Image must be under 2 MB.'); return }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setError('')
  }

  const handleResumePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (!/\.(pdf|doc|docx)$/i.test(file.name)) {
      setError('Only PDF or Word files.'); return
    }
    if (file.size > 50 * 1024 * 1024) { setError('Resume must be under 50 MB.'); return }
    setResumeFile(file)
    setError('')
  }

  const onSubmit = async () => {
    setLoading(true)
    setError('')
    setMessage('')

    const phoneDigits = phone.replace(/[^0-9]/g, '')

    try {
      // 1. Create account via backend (handles auth + student + file uploads atomically)
      const fd = new FormData()
      fd.append('email', email.trim())
      fd.append('password', password)
      fd.append('fullName', fullName.trim())
      fd.append('phone', phoneDigits)
      if (gender) fd.append('gender', gender)
      if (city.trim()) fd.append('city', city.trim())
      if (degree) fd.append('degree', degree)
      if (prevCompany.trim()) fd.append('prevCompany', prevCompany.trim())
      if (prevRole.trim()) fd.append('prevRole', prevRole.trim())
      if (experience) fd.append('experience', experience)
      if (domain) fd.append('domain', domain)
      if (linkedinUrl.trim()) fd.append('linkedinUrl', linkedinUrl.trim())
      if (naukriUrl.trim()) fd.append('naukriUrl', naukriUrl.trim())
      if (avatarFile) fd.append('avatar', avatarFile)
      if (resumeFile) fd.append('resume', resumeFile)

      const res = await fetch(`${getBackendOrigin()}/api/student/profile/signup`, {
        method: 'POST',
        body: fd,
      })

      const body = await res.json()

      if (!res.ok) {
        setError(body.error || 'Unable to create account. Please try again or contact support.')
        setLoading(false)
        return
      }

      // 2. Sign in the newly created user
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInErr) {
        setMessage('Account created! Please login.')
        setLoading(false)
        setTimeout(() => navigate('/login'), 1500)
        return
      }

      navigate('/home', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed.')
    } finally {
      setLoading(false)
    }
  }

  const stepLabels = ['Basic Details', 'Education & Professional', 'Profile Links']

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
        <div className="signup-form-wrap">
          <img src="/sit-logo.png" alt="SIT" className="login-logo" />
          <h2 className="login-heading">Create Account</h2>
          <p className="login-subheading">Fill in your details to get started</p>

          {/* Step indicator */}
          <div className="signup-steps">
            {stepLabels.map((label, i) => (
              <div key={i} className={`signup-step-item ${step > i + 1 ? 'done' : ''} ${step === i + 1 ? 'active' : ''}`}>
                <div className="signup-step-circle">
                  {step > i + 1 ? <Check size={14} /> : i + 1}
                </div>
                {step === i + 1 && <span className="signup-step-label">{label}</span>}
              </div>
            ))}
          </div>

          {/* Step 1 — Basic Details */}
          {step === 1 && (
            <div className="signup-step-body">
              <div className="signup-section-title"><User size={15} /> Basic Details <span className="login-req">*</span></div>
              <div className="signup-grid">
                <div className="login-field">
                  <label>Full Name <span className="login-req">*</span></label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Enter your full name" />
                </div>
                <div className="login-field">
                  <label>Email <span className="login-req">*</span></label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <div className="login-field">
                  <label>Phone <span className="login-req">*</span></label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 10)
                      setPhone(val)
                    }}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                  />
                </div>
                <div className="login-field">
                  <label>Password <span className="login-req">*</span></label>
                  <div className="login-pw-wrap">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                    />
                    <button type="button" className="login-pw-toggle" onClick={() => setShowPw(!showPw)}>
                      {showPw ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                </div>
                <div className="login-field">
                  <label>Gender <span className="login-req">*</span></label>
                  <select className="signup-select" value={gender} onChange={e => setGender(e.target.value)}>
                    <option value="">Select gender</option>
                    {GENDER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="login-field">
                  <label>City <span className="login-req">*</span></label>
                  <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Your city" />
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Education & Professional */}
          {step === 2 && (
            <div className="signup-step-body">
              <div className="signup-section-title"><Briefcase size={15} /> Education & Professional <span className="login-req">*</span></div>
              <div className="signup-grid">
                <div className="login-field">
                  <label>Degree <span className="login-req">*</span></label>
                  <select className="signup-select" value={degree} onChange={e => setDegree(e.target.value)}>
                    <option value="">Select degree</option>
                    {DEGREE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="login-field">
                  <label>Previous Company</label>
                  <input type="text" value={prevCompany} onChange={e => setPrevCompany(e.target.value)} placeholder="Company name" />
                </div>
                <div className="login-field">
                  <label>Previous Role <span className="login-req">*</span></label>
                  <input type="text" value={prevRole} onChange={e => setPrevRole(e.target.value)} placeholder="Job role" />
                </div>
                <div className="login-field">
                  <label>Experience (Years)</label>
                  <input type="number" value={experience} onChange={e => setExperience(e.target.value)} placeholder="e.g. 2" min="0" max="50" />
                </div>
                <div className="login-field">
                  <label>Domain <span className="login-req">*</span></label>
                  <select className="signup-select" value={domain} onChange={e => setDomain(e.target.value)}>
                    <option value="">Select domain</option>
                    {DOMAIN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Profile Links (optional) */}
          {step === 3 && (
            <div className="signup-step-body">
              <div className="signup-section-title"><Link2 size={15} /> Profile Details <span style={{ color: '#9CA3AF', fontWeight: 400, fontSize: 12 }}>(optional)</span></div>
              <div className="signup-grid">
                <div className="login-field">
                  <label>LinkedIn URL</label>
                  <input type="url" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." />
                </div>
                <div className="login-field">
                  <label>Naukri URL</label>
                  <input type="url" value={naukriUrl} onChange={e => setNaukriUrl(e.target.value)} placeholder="https://naukri.com/..." />
                </div>
                <div className="login-field">
                  <label>Resume</label>
                  <div className="signup-file-box" onClick={() => resumeRef.current?.click()}>
                    <Upload size={16} />
                    <span>{resumeFile ? resumeFile.name : 'Upload PDF or Word file'}</span>
                    <input ref={resumeRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={handleResumePick} />
                  </div>
                </div>
                <div className="login-field">
                  <label>Profile Photo</label>
                  <div className="signup-avatar-pick" onClick={() => avatarRef.current?.click()}>
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="avatar" className="signup-avatar-preview" />
                    ) : (
                      <div className="signup-avatar-placeholder">
                        <Upload size={18} />
                        <span>Upload Photo</span>
                      </div>
                    )}
                    <input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarPick} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && <p className="login-error">{error}</p>}
          {message && <p style={{ color: '#16A34A', fontSize: 13, margin: '8px 0' }}>{message}</p>}

          {/* Navigation buttons */}
          <div className="signup-nav-row">
            {step > 1 ? (
              <button type="button" className="signup-btn-back" onClick={goBack}>
                <ChevronLeft size={16} /> Back
              </button>
            ) : <span />}

            {step < 3 ? (
              <button type="button" className="signup-btn-next" onClick={goNext}>
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button type="button" className="signup-btn-submit" onClick={onSubmit} disabled={loading}>
                {loading ? 'Creating…' : 'Create Account'} &rarr;
              </button>
            )}
          </div>

          <div className="login-bottom-row" style={{ marginTop: 20 }}>
            <span />
            <span className="login-signup-text">Already have an account? <Link to="/login" className="login-signup-link">Login</Link></span>
          </div>
        </div>
      </div>
    </main>
  )
}
