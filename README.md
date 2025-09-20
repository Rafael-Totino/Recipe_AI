# recipes-ai (MVP texto+áudio)

Pipeline pessoal para extrair receitas de YouTube/Instagram:
- YouTube: transcript via youtube-transcript-api, fallback para áudio+Whisper
- Instagram: caption do post + (se for Reel) áudio para transcrever
- FastAPI (a implementar na sequência)

## Estrutura
- `src/services/` – fetchers e utilitários
- `scripts/` – testes manuais
