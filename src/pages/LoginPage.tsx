import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './LoginPage.css'

type TabType = 'signin' | 'signup'

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<TabType>('signin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Sign In fields
  const [signInEmail, setSignInEmail] = useState('')
  const [signInPassword, setSignInPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  // Sign Up fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [signUpEmail, setSignUpEmail] = useState('')
  const [signUpPassword, setSignUpPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [forgotError, setForgotError] = useState('')

  const { signIn, signUp, resetPassword } = useAuth()
  const navigate = useNavigate()

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await signIn(signInEmail, signInPassword)
    if (error) {
      setError(error.message)
    } else {
      navigate('/dashboard')
    }
    setLoading(false)
  }

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (signUpPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (signUpPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    const { error } = await signUp(signUpEmail, signUpPassword, {
      first_name: firstName,
      last_name: lastName,
    })

    if (error) {
      setError(error.message)
    } else {
      setError('')
      alert('Check your email for the confirmation link!')
      setActiveTab('signin')
    }
    setLoading(false)
  }

  const switchTab = (tab: TabType) => {
    setActiveTab(tab)
    setError('')
  }

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault()
    setForgotError('')
    setForgotLoading(true)

    const { error } = await resetPassword(forgotEmail)

    if (error) {
      setForgotError(error.message)
    } else {
      setForgotSuccess(true)
    }
    setForgotLoading(false)
  }

  const openForgotPassword = () => {
    setForgotEmail(signInEmail)
    setForgotSuccess(false)
    setForgotError('')
    setShowForgotPassword(true)
  }

  return (
    <div className="login-wrapper">
      {/* Left Panel */}
      <div className="left-panel">
        <div className="brand-content">
          <div className="ics-icon">⚠</div>
          <div className="logo-container">
            <img src="/alaminos-logo.png" alt="Municipality of Alaminos Logo" />
          </div>
          <h1 className="brand-title">Incident Command System</h1>
          <p className="brand-subtitle">Emergency Response Management</p>
          <p className="brand-location">Municipality of Alaminos</p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="right-panel">
        <div className="login-container">
          <div className="login-header">
            <h2>{activeTab === 'signin' ? 'Welcome' : 'Create Account'}</h2>
            <p>{activeTab === 'signin' ? 'Sign in to access the system' : 'Register for system access'}</p>
          </div>

          <div className="tab-buttons">
            <button
              className={`tab-btn ${activeTab === 'signin' ? 'active' : ''}`}
              onClick={() => switchTab('signin')}
            >
              Sign In
            </button>
            <button
              className={`tab-btn ${activeTab === 'signup' ? 'active' : ''}`}
              onClick={() => switchTab('signup')}
            >
              Sign Up
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}

          {/* Sign In Form */}
          {activeTab === 'signin' && (
            <form onSubmit={handleSignIn} className="auth-form">
              <div className="form-group">
                <label htmlFor="signin-email">Email Address</label>
                <input
                  type="email"
                  id="signin-email"
                  placeholder="Enter your email"
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="signin-password">Password</label>
                <input
                  type="password"
                  id="signin-password"
                  placeholder="Enter your password"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  required
                />
              </div>
              <div className="form-options">
                <label className="remember-me">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  Remember me
                </label>
                <a href="#" className="forgot-password" onClick={(e) => { e.preventDefault(); openForgotPassword() }}>Forgot Password?</a>
              </div>
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Sign Up Form */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignUp} className="auth-form signup-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="signup-firstname">First Name</label>
                  <input
                    type="text"
                    id="signup-firstname"
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="signup-lastname">Last Name</label>
                  <input
                    type="text"
                    id="signup-lastname"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="signup-email">Email Address</label>
                <input
                  type="email"
                  id="signup-email"
                  placeholder="Enter your email"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="signup-password">Password</label>
                <input
                  type="password"
                  id="signup-password"
                  placeholder="Create a password"
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="signup-confirm">Confirm Password</label>
                <input
                  type="password"
                  id="signup-confirm"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Creating Account...' : 'Sign Up'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Municipality Footer */}
      <div className="municipality-footer">
        <div className="main-text">Municipality of Alaminos</div>
        <div className="sub-text">Province of Laguna | Region IV-A Calabarzon</div>
      </div>

      {showForgotPassword && (
        <div className="modal-overlay" onClick={() => setShowForgotPassword(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Reset Password</h3>
            {forgotSuccess ? (
              <>
                <p className="modal-message">
                  A password reset link has been sent to <strong>{forgotEmail}</strong>. Please check your inbox and follow the instructions.
                </p>
                <div className="modal-actions">
                  <button className="modal-btn confirm" onClick={() => setShowForgotPassword(false)}>
                    OK
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="modal-message">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
                {forgotError && <div className="error-message">{forgotError}</div>}
                <form onSubmit={handleForgotPassword}>
                  <div className="form-group">
                    <label htmlFor="forgot-email">Email Address</label>
                    <input
                      id="forgot-email"
                      type="email"
                      placeholder="Enter your email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="modal-btn cancel" onClick={() => setShowForgotPassword(false)} disabled={forgotLoading}>
                      Cancel
                    </button>
                    <button type="submit" className="modal-btn confirm" disabled={forgotLoading}>
                      {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
