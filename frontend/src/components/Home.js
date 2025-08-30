// components/Home.js
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <div>
      <h1>Página Principal</h1>
      {isAuthenticated ? (
        <Link to="/dashboard">Ir al Dashboard</Link>
      ) : (
        <Link to="/login">Iniciar Sesión</Link>
      )}
    </div>
  );
}

export default Home;