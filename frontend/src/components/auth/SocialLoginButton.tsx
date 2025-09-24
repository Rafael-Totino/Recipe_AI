import './auth.css';

interface SocialLoginButtonProps {
  provider: 'google';
  onClick: () => void;
}

const SocialLoginButton = ({ provider, onClick }: SocialLoginButtonProps) => {
  const providerLabel = provider === 'google' ? 'Google' : provider;
  const icon = provider === 'google' ? '🟦' : '🔑';

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        borderRadius: '16px',
        border: '1px solid rgba(0,0,0,0.12)',
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.65rem',
        background: '#fff',
        cursor: 'pointer'
      }}
    >
      <span aria-hidden>{icon}</span>
      Entrar com {providerLabel}
    </button>
  );
};

export default SocialLoginButton;
