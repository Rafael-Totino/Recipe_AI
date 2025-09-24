# Recipe AI – Frontend

Aplicação frontend em React + Vite para o livro de receitas inteligente.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
```

Configure a URL do backend no arquivo `.env` na raiz do frontend:

```
VITE_API_BASE_URL=http://localhost:8000
```

## Funcionalidades

- Autenticação por e-mail e login social (Google) com layout dedicado.
- Dashboard principal com resumo, receitas favoritas e novidades importadas.
- Chat de IA persistente em toda a aplicação para busca e suporte.
- Importação de receitas via link ou cadastro manual.
- Página detalhada com player embutido, ingredientes, passos, observações e ações de compartilhamento/exclusão.
- Área de configurações para preferências alimentares que alimentam a IA.
