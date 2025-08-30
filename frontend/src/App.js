// App.js
import 'bootstrap/dist/css/bootstrap.min.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Home from './components/Home';
import SensorDashboard from './components/Sensores';

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Ruta pública */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      
      {/* Ruta de login - redirige si ya está autenticado */}
      <Route 
        path="/login" 
        element={
          isAuthenticated ? <Navigate to="/SensorDashboard" /> : <Login />
        } 
      />
      
      {/* Rutas protegidas */}
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />

      <Route
        path="/SensorDashboard"
        element={
          <PrivateRoute>
            <SensorDashboard />
          </PrivateRoute>
        }
      />
      
      {/* Otras rutas protegidas */}
      <Route
        path="/profile"
        element={
          <PrivateRoute>
            <h1>Perfil del Usuario</h1>
          </PrivateRoute>
        }
      />
      
      {/* Ruta 404 */}
      <Route path="*" element={<h1>404 - Página no encontrada</h1>} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <AppRoutes />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;