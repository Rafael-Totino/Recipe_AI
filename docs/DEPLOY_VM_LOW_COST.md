# Deploy em VM de baixo custo (API + Workers externos)

Este runbook prepara o Recipe_AI para rodar em uma VM simples com Supabase Postgres (fila), Cloudflare R2 e workers externos desacoplados.

## Pré-requisitos

- VM com Docker e Docker Compose instalados.
- Projeto Supabase com as migrations em `migrations/` aplicadas.
- Bucket Cloudflare R2 com credenciais.
- Um domínio apontado para a VM (para TLS com Caddy).

## 1) Aplicar migrations no Supabase

No SQL Editor do Supabase, rode:

```sql
-- migrations/001_transcription_jobs.sql
-- migrations/002_usage_daily.sql
-- migrations/003_embedding_jobs.sql
```

## 2) Configurar `.env`

Crie um arquivo `.env` na raiz do projeto com as variáveis necessárias:

```env
SUPABASE_URL=https://project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service-role-key

R2_ACCOUNT_ID=account-id
R2_ACCESS_KEY_ID=access-key
R2_SECRET_ACCESS_KEY=secret-key
R2_BUCKET_NAME=recipe-ai-media

GEMINI_API_KEY=your-gemini-api-key

# Opcional: sobrescrever modo da fila de embeddings
EMBEDDING_QUEUE_MODE=postgres

# Caddy (TLS automático)
CADDY_DOMAIN=api.seudominio.com
CADDY_EMAIL=admin@seudominio.com
```

## 3) Subir API + reverse proxy

```bash
docker compose up -d api caddy
```

Com isso, a API sobe stateless e o Caddy faz o TLS automático.

## 4) Subir workers sob demanda

### Transcriber

```bash
docker compose --profile transcriber up -d worker-transcriber
```

### Embedder

```bash
docker compose --profile embedder up -d worker-embedder
```

Também é possível subir todos os workers:

```bash
docker compose --profile workers up -d worker-transcriber worker-embedder
```

## 5) Parar workers quando não precisar

```bash
docker compose stop worker-transcriber worker-embedder
```

## Observações operacionais

- A API não inicia workers internos quando `EMBEDDING_QUEUE_MODE=postgres`.
- Os workers usam polling com backoff e encerram sozinhos caso a fila fique vazia (configurável via env).
- Reprocessamentos usam retries com backoff exponencial e lock TTL para evitar jobs presos.

## Comandos úteis

Logs da API:

```bash
docker compose logs -f api
```

Logs do worker de transcrição:

```bash
docker compose logs -f worker-transcriber
```

Logs do worker de embeddings:

```bash
docker compose logs -f worker-embedder
```
