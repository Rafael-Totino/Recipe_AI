import { FormEvent, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Location } from 'react-router-dom';

import SocialLoginButton from '../components/auth/SocialLoginButton';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const { loginWithEmail, loginWithProvider, signUpWithEmail, isLoading: isAuthBusy } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from?.pathname ?? '/app';

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const title = useMemo(
    () => (mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'),
    [mode]
  );

  const subtitle = useMemo(
    () =>
      mode === 'login'
        ? 'Entre com seu e-mail ou use sua conta Google para retomar sua experiência culinária.'
        : 'Cadastre-se para salvar e importar receitas com o Chef IA e crie seu atelier gastronômico.',
    [mode]
  );

  const eyebrowLabel = mode === 'login' ? 'Entrada do atelier' : 'Nova assinatura';
  const submitLabel = mode === 'login' ? 'Entrar' : 'Criar conta';
  const togglePrompt = mode === 'login' ? 'Ainda não tem conta?' : 'Já possui conta?';
  const toggleActionLabel = mode === 'login' ? 'Cadastre-se' : 'Entre';
  const passwordAutocomplete = mode === 'login' ? 'current-password' : 'new-password';
  const isProcessing = isPending || isAuthBusy;

  const resetMessages = () => {
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();
    setIsPending(true);
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
    } finally {
      setIsPending(false);
    }
  };

  const handleSocialLogin = async () => {
    resetMessages();
    setIsPending(true);
    try {
      await loginWithProvider('google');
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      setError('Falha na autenticação social.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="auth-card">
      <header className="auth-card__header">
        <span className="eyebrow">{eyebrowLabel}</span>
        <h2 className="auth-card__title font-playfair">{title}</h2>
        <p className="auth-card__subtitle text-muted">{subtitle}</p>
      </header>

      <div className="auth-card__social">
        <SocialLoginButton provider="google" onClick={handleSocialLogin} disabled={isProcessing} />
        <p className="auth-card__hint text-muted">Conecte-se rapidamente com sua conta Google.</p>
      </div>

      <div className="auth-card__divider" role="presentation">
        <span>ou continue com e-mail</span>
      </div>

      <form className="auth-card__form" onSubmit={handleSubmit} aria-busy={isProcessing}>
        {mode === 'signup' ? (
          <label className="auth-field">
            <span>Nome completo</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Como podemos te chamar?"
              autoComplete="name"
            />
          </label>
        ) : null}

        <label className="auth-field">
          <span>E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="você@exemplo.com"
            autoComplete="email"
            required
          />
        </label>

        <label className="auth-field">
          <span>Senha</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="********"
            autoComplete={passwordAutocomplete}
            required
          />
        </label>

        <div className="auth-card__messages" aria-live="polite">
          {error ? <p className="auth-card__message auth-card__message--error">{error}</p> : null}
          {info ? <p className="auth-card__message auth-card__message--info">{info}</p> : null}
        </div>

        <button type="submit" className="button button--primary auth-card__submit" disabled={isProcessing}>
          {isPending ? `${submitLabel}...` : submitLabel}
        </button>
      </form>

      <footer className="auth-card__footer">
        <span>{togglePrompt}</span>
        <button
          type="button"
          className="auth-card__toggle"
          onClick={() => {
            setMode((previousMode) => {
              const nextMode = previousMode === 'login' ? 'signup' : 'login';
              if (previousMode === 'signup') {
                setName('');
              }
              return nextMode;
            });
            resetMessages();
          }}
        >
          {toggleActionLabel}
        </button>
      </footer>
    </div>
  );
};

export default LoginPage;
