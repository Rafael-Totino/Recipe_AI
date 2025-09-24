import { Link } from 'react-router-dom';

const NotFoundPage = () => (
  <div
    style={{
      minHeight: '60vh',
      display: 'grid',
      placeItems: 'center',
      textAlign: 'center'
    }}
  >
    <div className="surface-card surface-card--muted" style={{ padding: '2.5rem', maxWidth: 480 }}>
      <h1>404</h1>
      <p style={{ color: 'var(--color-muted)' }}>
        Não encontramos essa página. Que tal voltar para a cozinha inteligente?
      </p>
      <Link
        to="/app"
        style={{
          display: 'inline-block',
          marginTop: '1rem',
          borderRadius: '16px',
          padding: '0.75rem 1.25rem',
          background: 'linear-gradient(135deg, #845ef7, #5c7cfa)',
          color: '#fff',
          fontWeight: 600
        }}
      >
        Voltar ao início
      </Link>
    </div>
  </div>
);

export default NotFoundPage;
