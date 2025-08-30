// components/Login.js
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Aplicar estilo al body cuando el componente se monta
    document.body.className = 'bg-success-subtle';
    
    // Limpiar el estilo cuando el componente se desmonta
    return () => {
      document.body.className = '';
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (username === 'grupo4_seccion_proy1' && password === 'HalaMadrid') {
      login({ username, role: 'admin' });
      navigate('/dashboard');
    } else {
      setError('Credenciales incorrectas');
    }
  };

  return (
    <div className="container min-vh-100 d-flex align-items-center justify-content-center">
      <div className="card p-4" style={{ width: '400px' }}>
        <h2 className="text-center mb-4">Iniciar Sesión</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Usuario:</label>
            <input
              type="text"
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Contraseña:</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="alert alert-danger">{error}</div>}
          <button type="submit" className="btn btn-success w-100">
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;