import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useRecipes } from '../context/RecipeContext';
import './cooking-mode.css';

const durationRegex = /(\d+)\s*(horas?|hora|minutos?|mins?|min)/gi;

type ActiveTimer = {
  remaining: number;
  label: string;
};

const CookingModePage = () => {
  const { recipeId } = useParams();
  const { activeRecipe, selectRecipe } = useRecipes();
  const navigate = useNavigate();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isVoiceSupported, setIsVoiceSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('Comandos desativados');
  const [showIngredients, setShowIngredients] = useState(false);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const recognitionRef = useRef<any>(null);
  const listeningRef = useRef(false);
  const hideIngredientsTimeout = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const touchStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (recipeId) {
      void selectRecipe(recipeId);
    }
  }, [recipeId, selectRecipe]);

  useEffect(() => {
    if (!activeRecipe) {
      return;
    }
    setCurrentStepIndex(0);
  }, [activeRecipe?.id]);

  useEffect(() => {
    document.body.classList.add('cooking-mode-active');
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch (error) {
        console.warn('Wake lock not available', error);
      }
    };

    void requestWakeLock();

    return () => {
      document.body.classList.remove('cooking-mode-active');
      if (wakeLockRef.current) {
        void wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results as ArrayLike<SpeechRecognitionResult>)
        .slice(event.resultIndex)
        .map((result: SpeechRecognitionResult) => result[0].transcript)
        .join(' ')
        .toLowerCase();
      handleVoiceCommand(transcript);
    };

    recognition.onerror = (event: any) => {
      console.warn('Reconhecimento de voz falhou', event.error);
      if (event.error === 'not-allowed') {
        setVoiceStatus('Permita o microfone para comandos de voz');
      }
    };

    recognition.onend = () => {
      if (listeningRef.current) {
        recognition.start();
      }
    };

    recognitionRef.current = recognition;
    setIsVoiceSupported(true);
    setVoiceStatus('Toque no microfone para ativar comandos');

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!activeTimer) {
      return;
    }
    const interval = window.setInterval(() => {
      setActiveTimer((prev) => {
        if (!prev) {
          return null;
        }
      if (prev.remaining <= 1) {
        if ('vibrate' in navigator) {
          (navigator as any).vibrate?.([120, 60, 120]);
        }
          setVoiceStatus('Timer concluído!');
          return null;
        }
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [activeTimer]);

  const steps = useMemo(
    () => (activeRecipe?.steps ?? []).sort((a, b) => a.order - b.order),
    [activeRecipe?.steps]
  );

  const currentStep = steps[currentStepIndex];

  const nextStep = () => {
    setCurrentStepIndex((index) => Math.min(index + 1, steps.length - 1));
  };

  const previousStep = () => {
    setCurrentStepIndex((index) => Math.max(index - 1, 0));
  };

  const formatTimer = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const startTimer = (seconds: number, label: string) => {
    if (!seconds) {
      return;
    }
    setActiveTimer({ remaining: seconds, label });
    setVoiceStatus(`Timer iniciado: ${label}`);
  };

  const handleVoiceCommand = (transcript: string) => {
    setVoiceStatus(`Você disse: "${transcript}"`);
    if (transcript.includes('próximo') || transcript.includes('proximo')) {
      nextStep();
      return;
    }
    if (transcript.includes('voltar') || transcript.includes('anterior')) {
      previousStep();
      return;
    }
    if (transcript.includes('ingrediente')) {
      revealIngredients();
      return;
    }

    if (transcript.includes('timer')) {
      const match = transcript.match(/(\d+)\s*(horas?|hora|minutos?|mins?|min)/);
      if (match) {
        const value = Number(match[1]);
        const unit = match[2];
        const seconds = unit.startsWith('hora') || unit.startsWith('horas') ? value * 3600 : value * 60;
        startTimer(seconds, `${value} ${unit}`);
        return;
      }
    }

    if (transcript.includes('ingredientes')) {
      revealIngredients();
    }
  };

  const toggleVoiceCommands = () => {
    if (!recognitionRef.current) {
      return;
    }
    if (isListening) {
      listeningRef.current = false;
      recognitionRef.current.stop();
      setIsListening(false);
      setVoiceStatus('Comandos desativados');
    } else {
      try {
        recognitionRef.current.start();
        listeningRef.current = true;
        setIsListening(true);
        setVoiceStatus('Ouvindo... diga "próximo passo"');
      } catch (error) {
        console.warn('Não foi possível iniciar o reconhecimento de voz', error);
      }
    }
  };

  const revealIngredients = () => {
    setShowIngredients(true);
    if (hideIngredientsTimeout.current) {
      window.clearTimeout(hideIngredientsTimeout.current);
    }
    hideIngredientsTimeout.current = window.setTimeout(() => setShowIngredients(false), 8000);
  };

  useEffect(() => () => {
    if (hideIngredientsTimeout.current) {
      window.clearTimeout(hideIngredientsTimeout.current);
    }
  }, []);

  const handleTouchStart = (clientX: number) => {
    touchStartRef.current = clientX;
  };

  const handleTouchEnd = (clientX: number) => {
    if (touchStartRef.current === null) {
      return;
    }
    const delta = touchStartRef.current - clientX;
    if (Math.abs(delta) > 60) {
      if (delta > 0) {
        nextStep();
      } else {
        previousStep();
      }
    }
    touchStartRef.current = null;
  };

  const renderStepDescription = (description: string) => {
    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    durationRegex.lastIndex = 0;

    while ((match = durationRegex.exec(description)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(description.slice(lastIndex, match.index));
      }
      const [full, value, unit] = match;
      const number = Number(value);
      const seconds = unit.startsWith('hora') || unit.startsWith('h') ? number * 3600 : number * 60;
      nodes.push(
        <button
          key={`${match.index}-${full}`}
          type="button"
          className="cooking-mode__timer-button"
          onClick={() => startTimer(seconds, full)}
        >
          {full}
        </button>
      );
      lastIndex = match.index + full.length;
    }

    if (lastIndex < description.length) {
      nodes.push(description.slice(lastIndex));
    }

    return nodes.map((node, index) => <Fragment key={index}>{node}</Fragment>);
  };

  if (!activeRecipe || !currentStep) {
    return null;
  }

  const progress = steps.length ? (currentStepIndex + 1) / steps.length : 0;

  return (
    <div
      className="cooking-mode"
      onTouchStart={(event) => handleTouchStart(event.changedTouches[0]?.clientX ?? 0)}
      onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
      onPointerDown={(event) => handleTouchStart(event.clientX)}
      onPointerUp={(event) => handleTouchEnd(event.clientX)}
    >
      <header className="cooking-mode__top">
        <button type="button" className="cooking-mode__back" onClick={() => navigate(-1)}>
          ← Atelier
        </button>
        <div className="cooking-mode__info">
          <span className="font-playfair">{activeRecipe.title}</span>
          <div className="cooking-mode__progress">
            <div style={{ transform: `scaleX(${progress || 0.01})` }} />
          </div>
          <small>
            Passo {currentStepIndex + 1} de {steps.length}
          </small>
        </div>
        <button
          type="button"
          className={`cooking-mode__voice${isListening ? ' is-active' : ''}`}
          onClick={toggleVoiceCommands}
          disabled={!isVoiceSupported}
        >
          {isVoiceSupported ? (isListening ? '🎙️' : '🎤') : '🚫'}
        </button>
      </header>

      <main className="cooking-mode__stage">
        <p className="cooking-mode__step-label">Passo {currentStep.order}</p>
        <div className="cooking-mode__step-text">{renderStepDescription(currentStep.description)}</div>
        {currentStep.tips ? <p className="cooking-mode__tip">💡 {currentStep.tips}</p> : null}
      </main>

      <footer className="cooking-mode__footer">
        <div className="cooking-mode__status">{voiceStatus}</div>
        {activeTimer ? (
          <div className="cooking-mode__timer" role="status">
            <span>{activeTimer.label}</span>
            <strong>{formatTimer(activeTimer.remaining)}</strong>
            <button type="button" onClick={() => setActiveTimer(null)}>
              Cancelar
            </button>
          </div>
        ) : null}
        <div className="cooking-mode__nav">
          <button type="button" className="button button--ghost" onClick={previousStep} disabled={currentStepIndex === 0}>
            Passo anterior
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={nextStep}
            disabled={currentStepIndex === steps.length - 1}
          >
            Próximo passo
          </button>
        </div>
        <button type="button" className="cooking-mode__ingredients" onClick={revealIngredients}>
          Ver ingredientes
        </button>
      </footer>

      <aside className={`cooking-mode__ingredients-panel${showIngredients ? ' is-visible' : ''}`}>
        <h2>Ingredientes</h2>
        <ul>
          {(activeRecipe.ingredients ?? []).map((ingredient) => (
            <li key={`${ingredient.name}-${ingredient.quantity ?? ''}`}>
              <strong>{ingredient.quantity ? `${ingredient.quantity} ` : ''}</strong>
              {ingredient.name}
              {ingredient.notes ? <em> – {ingredient.notes}</em> : null}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
};

export default CookingModePage;
