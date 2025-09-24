import { FormEvent, useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';

const arrayFromInput = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const SettingsPage = () => {
  const { user, updatePreferences, refreshUserProfile } = useAuth();
  const [dietaryRestrictions, setDietaryRestrictions] = useState('');
  const [dislikedIngredients, setDislikedIngredients] = useState('');
  const [favoriteCuisines, setFavoriteCuisines] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  return (
    <div className="surface-card" style={{ display: 'grid', gap: '1.25rem' }}>
      <div>
        <h1 style={{ margin: 0 }}>Seu perfil</h1>
        <p style={{ margin: 0, color: 'var(--color-muted)' }}>
          Conte para a IA sobre suas preferências alimentares e ela personalizará as sugestões.
        </p>
      </div>

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
          style={{
            borderRadius: '16px',
            border: 'none',
            padding: '0.75rem 1.2rem',
            background: 'linear-gradient(135deg, #845ef7, #5c7cfa)',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          {isSaving ? 'Salvando...' : 'Salvar preferências'}
        </button>
      </form>

      {status ? <div className="surface-card surface-card--muted">{status}</div> : null}
    </div>
  );
};

export default SettingsPage;
