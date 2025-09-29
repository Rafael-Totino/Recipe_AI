import { FormEvent, useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';

const arrayFromInput = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const ProfilePage = () => {
  const { user, updatePreferences, refreshUserProfile, logout } = useAuth();
  const [dietaryRestrictions, setDietaryRestrictions] = useState('');
  const [dislikedIngredients, setDislikedIngredients] = useState('');
  const [favoriteCuisines, setFavoriteCuisines] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    setDietaryRestrictions(user?.preferences?.dietaryRestrictions?.join(', ') ?? '');
    setDislikedIngredients(user?.preferences?.dislikedIngredients?.join(', ') ?? '');
    setFavoriteCuisines(user?.preferences?.favoriteCuisines?.join(', ') ?? '');
  }, [user?.preferences]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    await updatePreferences({
      dietaryRestrictions: arrayFromInput(dietaryRestrictions),
      dislikedIngredients: arrayFromInput(dislikedIngredients),
      favoriteCuisines: arrayFromInput(favoriteCuisines)
    });
    await refreshUserProfile();
    setIsSaving(false);
    setStatus('Preferências atualizadas! Sua IA já está sabendo das novidades.');
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="surface-card" style={{ display: 'grid', gap: '1.5rem' }}>
      <div>
        <h1 style={{ margin: 0 }}>Seu perfil</h1>
        <p style={{ margin: 0, color: 'var(--color-muted-strong)' }}>
          Conte para a IA sobre suas preferências alimentares e ela personalizará as sugestões.
        </p>
      </div>

      <section style={{ display: 'grid', gap: '1.25rem' }}>
        <header>
          <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem' }}>Preferências culinárias</h2>
          <p style={{ margin: 0, color: 'var(--color-muted)' }}>
            Personalize sua experiência avisando o que gosta, evita ou prefere destacar.
          </p>
        </header>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Restrições alimentares (separe por vírgula)</span>
            <input value={dietaryRestrictions} onChange={(event) => setDietaryRestrictions(event.target.value)} />
          </label>

          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Ingredientes que você evita</span>
            <input value={dislikedIngredients} onChange={(event) => setDislikedIngredients(event.target.value)} />
          </label>

          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span>Culinárias favoritas</span>
            <input value={favoriteCuisines} onChange={(event) => setFavoriteCuisines(event.target.value)} />
          </label>

          <button
            type="submit"
            disabled={isSaving}
            className="button button--primary"
            style={{ justifySelf: 'start' }}
          >
            {isSaving ? 'Salvando...' : 'Salvar preferências'}
          </button>
        </form>

        {status ? <div className="surface-card surface-card--muted">{status}</div> : null}
      </section>

      <section style={{ display: 'grid', gap: '0.75rem' }}>
        <header>
          <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.25rem' }}>Conta</h2>
          <p style={{ margin: 0, color: 'var(--color-muted)' }}>
            {user?.email ?? 'Conta autenticada'}
          </p>
        </header>
        <button
          type="button"
          onClick={handleLogout}
          className="button button--ghost"
          disabled={isLoggingOut}
          style={{ justifySelf: 'start' }}
        >
          {isLoggingOut ? 'Saindo...' : 'Encerrar sessão'}
        </button>
      </section>
    </div>
  );
};

export default ProfilePage;
