import { FormEvent, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Location } from 'react-router-dom';

import SocialLoginButton from '../components/auth/SocialLoginButton';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const { loginWithEmail, loginWithProvider, signUpWithEmail, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from?.pathname ?? '/app';

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const title = useMemo(
    () => (mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'),
    [mode]
  );

  const subtitle = useMemo(
    () =>
      mode === 'login'
        ? 'Entre com seu e-mail ou use sua conta Google.'
        : 'Cadastre-se para salvar e importar receitas com o Chef IA.',
    [mode]
  );

  const submitLabel = mode === 'login' ? 'Entrar' : 'Criar conta';

  const toggleLabel =
    mode === 'login'
      ? 'Ainda não tem conta? Cadastre-se'
      : 'Já possui conta? Entre';

  const resetMessages = () => {
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
        navigate(from, { replace: true });
        return;
      }

      const result = await signUpWithEmail({ email, password, name: name || undefined });
      if (result.needsConfirmation) {
        setInfo('Verifique seu e-mail para confirmar a conta antes de continuar.');
        setName('');
        setPassword('');
        return;
      }
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      setError(
        mode === 'login'
          ? 'Não foi possível entrar. Verifique suas credenciais.'
          : 'Não foi possível criar sua conta. Verifique os dados informados.'
      );
    }
  };

  const handleSocialLogin = async () => {
    resetMessages();
    try {
      await loginWithProvider('google');
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      setError('Falha na autenticação social.');
    }
  };

  return (
    <div className="auth-card">
      <div>
        <h2>{title}</h2>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--color-muted)' }}>{subtitle}</p>
      </div>

      <div className="social-login-group">
        <SocialLoginButton provider="google" onClick={handleSocialLogin} />
      </div>

      <div className="divider">ou continue com e-mail</div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
        {mode === 'signup' ? (
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span style={{ fontWeight: 500 }}>Nome</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Como podemos chamar você?"
            />
          </label>
        ) : null}

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
            placeholder="********"
            required
          />
        </label>

        {error ? <p style={{ color: '#d64545', margin: 0 }}>{error}</p> : null}
        {info ? <p style={{ color: '#2f9e44', margin: 0 }}>{info}</p> : null}

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
          {isLoading ? `${submitLabel}...` : submitLabel}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
          resetMessages();
        }}
        style={{
          marginTop: '1rem',
          border: 'none',
          background: 'none',
          color: 'var(--color-primary)',
          cursor: 'pointer',
          fontWeight: 500
        }}
      >
        {toggleLabel}
      </button>
    </div>
  );
};

export default LoginPage;
