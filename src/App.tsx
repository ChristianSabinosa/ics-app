import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import FormAccess from './components/FormAccess'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import CreateIncident from './pages/CreateIncident'
import JoinIncident from './pages/JoinIncident'
import OngoingIncidents from './pages/OngoingIncidents'
import IncidentPage from './pages/IncidentPage'
import IapPreviewPage from './pages/IapPreviewPage'
import CheckInForm from './pages/CheckInForm'
import CheckInView from './pages/CheckInView'
import Ics211Form from './pages/Ics211Form'
import Ics207Form from './pages/Ics207Form'
import Ics201Form from './pages/Ics201Form'
import IncidentMapForm from './pages/IncidentMapForm'
import Ics202Form from './pages/Ics202Form'
import Ics203Form from './pages/Ics203Form'
import Ics204List from './pages/Ics204List'
import Ics204Form from './pages/Ics204Form'
import Ics205Form from './pages/Ics205Form'
import Ics206Form from './pages/Ics206Form'
import Ics208Form from './pages/Ics208Form'
import Ics209Form from './pages/Ics209Form'
import Ics213Form from './pages/Ics213Form'
import Ics214Form from './pages/Ics214Form'
import Ics214List from './pages/Ics214List'
import Ics215Form from './pages/Ics215Form'
import Ics215AForm from './pages/Ics215AForm'
import Ics221Form from './pages/Ics221Form'
import Ics221List from './pages/Ics221List'
import MessagesPage from './pages/MessagesPage'
import MessageForm from './pages/MessageForm'
import ProfilePage from './pages/ProfilePage'
import NotificationToast from './components/NotificationToast'

/**
 * Fallback for any URL that does not match a route.
 * Signed-out users go to the login screen (remembering where they were headed);
 * signed-in users get an explanatory page instead of being dumped on the sign-in
 * screen — which previously made a stale/missing route look like a logout.
 */
function RouteFallback() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#950606' }}>
        Loading...
      </div>
    )
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '14px',
      padding: '24px',
      textAlign: 'center',
      fontFamily: 'inherit',
    }}>
      <h1 style={{ color: '#950606', fontSize: '1.4rem', margin: 0 }}>Page not found</h1>
      <p style={{ color: '#555', fontSize: '0.95rem', margin: 0 }}>
        No route matches <code style={{ background: '#f3f3f3', padding: '2px 6px', borderRadius: '4px' }}>{location.pathname}</code>.
        <br />
        If you got here from the Incident Action Plan, reload the app (Ctrl+Shift+R) — an outdated bundle can miss new routes.
      </p>
      <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
        <button
          onClick={() => window.history.back()}
          style={{ padding: '10px 20px', borderRadius: '8px', border: '2px solid #ddd', background: 'white', color: '#555', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Go back
        </button>
        <button
          onClick={() => { window.location.href = '/dashboard' }}
          style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#950606', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/create-incident" element={<ProtectedRoute><CreateIncident /></ProtectedRoute>} />
          <Route path="/join-incident" element={<ProtectedRoute><JoinIncident /></ProtectedRoute>} />
          <Route path="/ongoing-incidents" element={<ProtectedRoute><OngoingIncidents /></ProtectedRoute>} />
          {/* Mailbox is global rather than incident-scoped, so it gets
              ProtectedRoute only — FormAccess needs a :id in the URL to work
              out a role, and there is none here. */}
          <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
          <Route path="/messages/compose" element={<ProtectedRoute><MessageForm /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/incident/:id" element={<ProtectedRoute><IncidentPage /></ProtectedRoute>} />
          <Route path="/incident/:id/iap/:iapId" element={<ProtectedRoute><FormAccess form="IAP"><IapPreviewPage /></FormAccess></ProtectedRoute>} />
          <Route path="/incident/:id/checkin" element={<ProtectedRoute><FormAccess form="CHECKIN"><CheckInForm /></FormAccess></ProtectedRoute>} />
          <Route path="/incident/:id/checkin/view" element={<ProtectedRoute><FormAccess form="CHECKIN"><CheckInView /></FormAccess></ProtectedRoute>} />
          <Route path="/incident/:id/ics-211" element={<ProtectedRoute><FormAccess form="211"><Ics211Form /></FormAccess></ProtectedRoute>} />
          <Route path="/incident/:id/ics-207" element={<ProtectedRoute><FormAccess form="207"><Ics207Form /></FormAccess></ProtectedRoute>} />
          <Route path="/incident/:id/ics-201" element={<ProtectedRoute><FormAccess form="201"><Ics201Form /></FormAccess></ProtectedRoute>} />
          <Route path="/incident/:id/incident-map" element={<ProtectedRoute><FormAccess form="MAP"><IncidentMapForm /></FormAccess></ProtectedRoute>} />
          <Route path="/incident/:id/ics-202" element={<ProtectedRoute><FormAccess form="202"><Ics202Form /></FormAccess></ProtectedRoute>} />
          <Route path="/incident/:id/ics-203" element={<ProtectedRoute><FormAccess form="203"><Ics203Form /></FormAccess></ProtectedRoute>} />
          <Route path="/incident/:id/ics-204" element={<ProtectedRoute><FormAccess form="204"><Ics204List /></FormAccess></ProtectedRoute>} />
          <Route path="/incident/:id/ics-204/edit" element={<ProtectedRoute><FormAccess form="204"><Ics204Form /></FormAccess></ProtectedRoute>} />
          <Route path="/incident/:id/ics-205" element={<ProtectedRoute><FormAccess form="205"><Ics205Form /></FormAccess></ProtectedRoute>} />
          <Route path="/incident/:id/ics-206" element={<ProtectedRoute><FormAccess form="206"><Ics206Form /></FormAccess></ProtectedRoute>} />
          <Route path="/incident/:id/ics-208" element={<ProtectedRoute><FormAccess form="208"><Ics208Form /></FormAccess></ProtectedRoute>} />
          <Route path="/incident/:id/ics-209" element={<ProtectedRoute><FormAccess form="209"><Ics209Form /></FormAccess></ProtectedRoute>} />
          <Route path="/incident/:id/ics-213" element={<ProtectedRoute><FormAccess form="213"><Ics213Form /></FormAccess></ProtectedRoute>} />
          <Route path="/incident/:id/ics-214" element={<ProtectedRoute><FormAccess form="214"><Ics214List /></FormAccess></ProtectedRoute>} />
          <Route path="/incident/:id/ics-214/edit" element={<ProtectedRoute><FormAccess form="214"><Ics214Form /></FormAccess></ProtectedRoute>} />
          <Route path="/incident/:id/ics-215" element={<ProtectedRoute><FormAccess form="215"><Ics215Form /></FormAccess></ProtectedRoute>} />
          <Route path="/incident/:id/ics-215a" element={<ProtectedRoute><FormAccess form="215-A"><Ics215AForm /></FormAccess></ProtectedRoute>} />
          <Route path="/incident/:id/ics-221" element={<ProtectedRoute><FormAccess form="221"><Ics221List /></FormAccess></ProtectedRoute>} />
          <Route path="/incident/:id/ics-221/edit" element={<ProtectedRoute><FormAccess form="221"><Ics221Form /></FormAccess></ProtectedRoute>} />
          <Route path="*" element={<RouteFallback />} />
        </Routes>
        {/* Arrival popup only — the notification list lives in the profile
            dropdown on the Dashboard. Renders nothing while signed out. */}
        <NotificationToast />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
