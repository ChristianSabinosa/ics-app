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
import Ics207Form from './pages/Ics207Form'
import Ics202Form from './pages/Ics202Form'
import Ics203Form from './pages/Ics203Form'
import Ics205Form from './pages/Ics205Form'
import Ics206Form from './pages/Ics206Form'
import Ics208Form from './pages/Ics208Form'
import Ics209Form from './pages/Ics209Form'
import Ics213Form from './pages/Ics213Form'
import Ics214Form from './pages/Ics214Form'
import Ics215Form from './pages/Ics215Form'
import Ics215AForm from './pages/Ics215AForm'

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
          <Route path="/incident/:id/ics-207" element={<ProtectedRoute><Ics207Form /></ProtectedRoute>} />
          <Route path="/incident/:id/ics-202" element={<ProtectedRoute><Ics202Form /></ProtectedRoute>} />
          <Route path="/incident/:id/ics-203" element={<ProtectedRoute><Ics203Form /></ProtectedRoute>} />
          <Route path="/incident/:id/ics-205" element={<ProtectedRoute><Ics205Form /></ProtectedRoute>} />
          <Route path="/incident/:id/ics-206" element={<ProtectedRoute><Ics206Form /></ProtectedRoute>} />
          <Route path="/incident/:id/ics-208" element={<ProtectedRoute><Ics208Form /></ProtectedRoute>} />
          <Route path="/incident/:id/ics-209" element={<ProtectedRoute><Ics209Form /></ProtectedRoute>} />
          <Route path="/incident/:id/ics-213" element={<ProtectedRoute><Ics213Form /></ProtectedRoute>} />
          <Route path="/incident/:id/ics-214" element={<ProtectedRoute><Ics214Form /></ProtectedRoute>} />
          <Route path="/incident/:id/ics-215" element={<ProtectedRoute><Ics215Form /></ProtectedRoute>} />
          <Route path="/incident/:id/ics-215a" element={<ProtectedRoute><Ics215AForm /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
