import './auth.css';

interface SocialLoginButtonProps {
  provider: 'google';
  onClick: () => void;
  disabled?: boolean;
}

const GoogleIcon = () => (
  <svg
    className="auth-social-button__svg"
    aria-hidden
    focusable="false"
    width="18"
    height="18"
    viewBox="0 0 18 18"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.839H9v3.48h4.836c-.2083 1.125-.8355 2.0794-1.7805 2.7182v2.2636h2.8827c1.6891-1.5573 2.6628-3.849 2.6628-6.6228z"
      fill="#4285F4"
    />
    <path
      d="M9 18c2.41 0 4.4332-.7977 5.911-2.1736l-2.8828-2.2636c-.7982.5373-1.8205.8536-3.0282.8536-2.3277 0-4.2978-1.5728-4.9996-3.6894H0.0305v2.321C1.4995 15.9836 4.0195 18 9 18z"
      fill="#34A853"
    />
    <path
      d="M4.0005 10.727c-.182-.5373-.2855-1.1113-.2855-1.727 0-.6158.1035-1.1898.2855-1.727V4.9525H0.0305C-.3213 5.765-.5 6.6645-.5 7.6375s.1787 1.8726.5305 2.6851l3.4705-1.5956z"
      fill="#FBBC04"
    />
    <path
      d="M9 3.541c1.3095 0 2.4818.4505 3.4064 1.3336l2.5541-2.5541C13.4282.8468 11.4059 0 9 0 4.0195 0 1.4995 2.0164.0305 4.9525l3.97 3.0204C4.7022 5.855 6.6723 4.2822 9 4.2822z"
      fill="#EA4335"
    />
  </svg>
);

const SocialLoginButton = ({ provider, onClick, disabled }: SocialLoginButtonProps) => {
  const providerLabel = provider === 'google' ? 'Google' : provider;

  return (
    <button type="button" onClick={onClick} className="auth-social-button" disabled={disabled}>
      <span className="auth-social-button__icon" aria-hidden>
        <GoogleIcon />
      </span>
      <span className="auth-social-button__label">Entrar com {providerLabel}</span>
    </button>
  );
};

export default SocialLoginButton;
