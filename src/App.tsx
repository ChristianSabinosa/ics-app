import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import CreateIncident from './pages/CreateIncident'
import JoinIncident from './pages/JoinIncident'
import OngoingIncidents from './pages/OngoingIncidents'
import IncidentPage from './pages/IncidentPage'
import CheckInForm from './pages/CheckInForm'
import CheckInView from './pages/CheckInView'
import Ics211Form from './pages/Ics211Form'

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
          <Route path="/incident/:id" element={<ProtectedRoute><IncidentPage /></ProtectedRoute>} />
          <Route path="/incident/:id/checkin" element={<ProtectedRoute><CheckInForm /></ProtectedRoute>} />
          <Route path="/incident/:id/checkin/view" element={<ProtectedRoute><CheckInView /></ProtectedRoute>} />
          <Route path="/incident/:id/ics-211" element={<ProtectedRoute><Ics211Form /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
