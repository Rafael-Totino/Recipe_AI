import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Location } from 'react-router-dom';

import SocialLoginButton from '../components/auth/SocialLoginButton';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const { loginWithEmail, loginWithProvider, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from?.pathname ?? '/app';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await loginWithEmail(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      setError('Não foi possível entrar. Verifique suas credenciais.');
    }
  };

  const handleSocialLogin = async () => {
    try {
      // Em produção, substitua pelo token retornado pelo Google Identity Services
      const fakeToken = window.prompt('Cole o token do Google para continuar:');
      if (!fakeToken) {
        return;
      }
      await loginWithProvider('google', fakeToken);
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      setError('Falha na autenticação social.');
    }
  };

  return (
    <div className="auth-card">
      <div>
        <h2>Bem-vindo de volta 👋</h2>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--color-muted)' }}>
          Entre com seu e-mail ou use sua conta Google.
        </p>
      </div>

      <div className="social-login-group">
        <SocialLoginButton provider="google" onClick={handleSocialLogin} />
      </div>

      <div className="divider">ou continue com e-mail</div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span style={{ fontWeight: 500 }}>E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@exemplo.com"
            required
          />
        </label>

        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span style={{ fontWeight: 500 }}>Senha</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
          />
        </label>

        {error ? <p style={{ color: '#d64545', margin: 0 }}>{error}</p> : null}

        <button
          type="submit"
          style={{
            borderRadius: '16px',
            border: 'none',
            padding: '0.85rem 1rem',
            background: 'linear-gradient(135deg, #845ef7, #5c7cfa)',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer'
          }}
          disabled={isLoading}
        >
          {isLoading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
