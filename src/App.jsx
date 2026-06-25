import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Spinner from './components/Spinner'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import YoungAdults from './pages/YoungAdults'
import YouthProfile from './pages/YouthProfile'
import Referrals from './pages/Referrals'
import Agencies from './pages/Agencies'
import AgencyProfile from './pages/AgencyProfile'
import Notifications from './pages/Notifications'
import Admin from './pages/Admin'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <Spinner size={32} />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="youth" element={<YoungAdults />} />
        <Route path="youth/:id" element={<YouthProfile />} />
        <Route path="agencies" element={<Agencies />} />
        <Route path="agencies/:id" element={<AgencyProfile />} />
        <Route path="referrals" element={<Referrals />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="admin" element={<Admin />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
