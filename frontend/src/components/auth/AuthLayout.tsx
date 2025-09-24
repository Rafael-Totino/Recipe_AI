import { Outlet } from 'react-router-dom';

import './auth.css';

const AuthLayout = () => {
  return (
    <div className="auth-layout">
      <section className="auth-hero">
        <div className="auth-hero__content">
          <h1>Recipe AI</h1>
          <p>
            Um livro de receitas inteligente com um sous-chef virtual sempre ao seu lado. Importe
            receitas das redes sociais, organize as suas favoritas e receba dicas em tempo real.
          </p>
        </div>
        <ul>
          <li>Converse com a IA durante toda a experiência</li>
          <li>Salve receitas das redes sociais em um clique</li>
          <li>Crie playlists culinárias com áudio e vídeo</li>
        </ul>
      </section>
      <section className="auth-form">
        <Outlet />
      </section>
    </div>
  );
};

export default AuthLayout;
