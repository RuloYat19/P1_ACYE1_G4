// components/Dashboard.js
import { useAuth } from '../context/AuthContext';

function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Bienvenido, {user?.username}!</p>
      <p>Rol: {user?.role}</p>
      <button onClick={logout}>Cerrar Sesión</button>
    </div>
  );
}

export default Dashboard;