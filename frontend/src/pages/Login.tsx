import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('grupo4_seccion_proy1');
  const [password, setPassword] = useState('HalaMadrid');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await login(username.trim(), password);
    if (ok) navigate('/dashboard');
    else setError('Credenciales inválidas');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-white p-6 rounded-xl shadow">
        <h1 className="text-2xl font-semibold mb-4">Iniciar sesión</h1>
        {error && <div className="text-sm text-rose-600 mb-2">{error}</div>}
        <label className="block mb-2 text-sm">Usuario</label>
        <input value={username} onChange={e=>setUsername(e.target.value)} className="w-full mb-3 p-2 border rounded" />
        <label className="block mb-2 text-sm">Contraseña</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full mb-4 p-2 border rounded" />
        <button className="w-full bg-slate-800 text-white py-2 rounded">Entrar</button>
      </form>
    </div>
  );
};

export default Login;
