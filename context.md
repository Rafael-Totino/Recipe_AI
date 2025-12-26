# Recipe AI — Project Context

## Visão Geral
O **Recipe AI** é um aplicativo para salvar, organizar e buscar receitas de forma inteligente, a partir de:
- Links de redes sociais (YouTube, Instagram, TikTok)
- Áudio/Vídeo (transcrição automática)
- Entrada manual

O foco do projeto é:
- **UX rápida e agradável**
- **Busca inteligente com IA (RAG + embeddings)**
- **Arquitetura desacoplada, escalável e de baixo custo**
- **MVP parrudo**, usado inicialmente pelo próprio autor, amigos e familiares

---

## Stack Tecnológica (atual)

### Frontend
- **Web**: React + TypeScript
- **Mobile (futuro)**: Flutter
- **Tempo real**: Supabase Realtime (para status/progresso de jobs)

### Backend
- **API**: Python + FastAPI
- **Arquitetura**: stateless, orientada a serviços
- **Deploy atual**: Docker (rodando localmente via Windows + WSL2)

### Processamento Assíncrono
- **Fila de jobs**: Supabase Postgres
  - Padrão: `FOR UPDATE SKIP LOCKED`
  - RPCs específicas para lock seguro de jobs
- **Workers separados**:
  - `transcriber`: transcrição de áudio/vídeo (SLA rápido)
  - `embedder`: geração de embeddings (pode ser mais lento)

### IA
- **Transcrição**: fast-whisper (local, CPU)
- **Embeddings**: modelo externo (ex: Gemini ou equivalente)
- **RAG**: pgvector no Supabase

### Storage
- **Mídia (áudio/vídeo)**: Cloudflare R2 (S3-compatible)
- Upload via **Signed URLs**

### Infra Externa
- **DB + fila + realtime**: Supabase
- **Frontend hosting**: Firebase Hosting
- **Acesso externo à API local**: Cloudflare Tunnel (sem domínio próprio)

---

## Arquitetura de Jobs (ponto central do projeto)

### Transcription Jobs (`transcription_jobs`)
- Estados principais:
  - `QUEUED`
  - `RUNNING`
  - `DONE`
  - `FAILED`
- Campos importantes:
  - `stage`: `DOWNLOADING | TRANSCRIBING | FINALIZING | DONE`
  - `progress`: 0–100 (%)
  - `last_heartbeat_at`: detecção de worker travado
- Atualizações:
  - `progress`: a cada ~5s (throttled)
  - `heartbeat`: a cada ~20s
- Atualização em tempo real no frontend via Supabase Realtime

### Embedding Jobs (`embedding_jobs`)
- Executados **após a transcrição**
- Não são críticos para SLA
- Podem rodar com polling mais lento
- Também seguem padrão Postgres queue + worker separado

---

## Decisões Arquiteturais Importantes

- **Nada síncrono pesado na API**
- **Nada de fila in-memory em produção**
- **Todos os processos longos viram jobs persistentes**
- **Workers desacoplados do lifecycle da API**
- **Infra minimamente dependente de cloud paga**
- **Facilidade de migração futura para RabbitMQ / Temporal**

---

## Estratégia de SLA
- Worker **transcriber** roda **sempre ligado** (sem cron)
- Modelo de IA fica “quente” em memória
- Polling curto na fila (≈1s)
- UX percebe rapidez via:
  - status em tempo real
  - progress bar
- Worker **embedder** pode ser lento sem afetar UX

---

## Deploy Atual (temporário / MVP)
- **Servidor**: PC pessoal (Windows + WSL2)
- **Motivo**: custo ~0, hardware potente, MVP
- **Segurança**:
  - Nenhuma porta aberta no roteador
  - Acesso externo via Cloudflare Tunnel
- **Objetivo**: manter SLA rápido durante fase inicial
- **Futuro**: migrar para VM dedicada quando escalar

---

## Limites do MVP (conscientes)
- Sem streaming parcial de texto (apenas progress)
- Sem SLA formal
- Sem GPU cloud
- Sem alta disponibilidade

---

## Direções Futuras
- Flutter mobile app
- Notificações push (FCM)
- Migração opcional para RabbitMQ
- Pipeline de enriquecimento de receitas (tags, ingredientes estruturados)
- Painel admin de jobs/uso
- Monetização futura

---

## Orientações para Agentes de IA (Codex / Cursor / Claude)
- Sempre respeitar arquitetura desacoplada
- Não introduzir dependências cloud caras sem justificar
- Priorizar soluções simples e robustas
- Código limpo, tipado, com logs claros
- Qualquer processamento pesado → worker + fila
- Preparar o código para evolução, não para overengineering

---

## Objetivo deste Projeto no ChatGPT
Este projeto serve para:
- Discussões arquiteturais
- Planejamento técnico
- Decisões de custo/infra
- Geração de prompts para agentes de código
- Revisão de estratégias de escala
- Acompanhamento da evolução do Recipe AI

Tudo aqui deve assumir **este contexto como verdade base**.
