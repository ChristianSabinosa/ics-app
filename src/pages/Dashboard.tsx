import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import './Dashboard.css'

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-brand">
          <img src="/alaminos-logo.png" alt="Logo" className="header-logo" />
          <div>
            <h1>Incident Command System</h1>
            <p>Municipality of Alaminos</p>
          </div>
        </div>
        <div className="header-right">
          <span className="user-name">{user?.user_metadata?.first_name || user?.email}</span>
          <button onClick={handleSignOut} className="signout-btn">Sign Out</button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="welcome-section">
          <h2>Welcome, {user?.user_metadata?.first_name || 'User'}</h2>
          <p>What would you like to do?</p>
        </div>

        <div className="action-cards">
          <button className="action-card create" onClick={() => navigate('/create-incident')}>
            <div className="action-icon">+</div>
            <h3>Create an Incident</h3>
            <p>Report a new incident and start command operations</p>
          </button>

          <button className="action-card join" onClick={() => navigate('/join-incident')}>
            <div className="action-icon">→</div>
            <h3>Join an Incident</h3>
            <p>Enter an incident code to join an ongoing response</p>
          </button>

          <button className="action-card view" onClick={() => navigate('/ongoing-incidents')}>
            <div className="action-icon">≡</div>
            <h3>View Ongoing Incidents</h3>
            <p>Monitor all active incidents in the municipality</p>
          </button>
        </div>
      </main>
    </div>
  )
}
