# CS2 HUB

Plataforma de estatísticas e acompanhamento competitivo de Counter-Strike 2.
Projeto independente, sem vínculo com Valve ou bo3.gg.

## Executar localmente

Requisitos: Node.js 18+.

```bash
npm install
cp .env.example .env     # preencha conforme a etapa
npm run dev              # http://localhost:3000
```

Páginas internas são geradas por `node scripts/build-pages.js` (template único).

## Estrutura

- `frontend/` HTML/CSS/JS (componentes em `js/components.js`)
- `backend/` Express: `config`, `middleware`, `routes`, `controllers`, `services`
- `database/migrations/` migrations SQL (Etapa 2)

## API (Etapa 1)

- `GET /api/health` — status do servidor
- `GET /api/admin/providers` — status das integrações (header `Authorization: Bearer <ADMIN_TOKEN>`)

## Segurança

Chaves ficam só no `.env` (ignorado pelo git) e nunca são enviadas ao frontend.
Helmet (CSP), rate limiting e token para rotas administrativas já estão ativos.

## Estado das etapas

1. Estrutura, visual, home, navegação — **concluída**
2. Supabase + PandaScore — pendente
3. FACEIT, jogadores, equipes, rankings — pendente
4. Estatísticas avançadas e gráficos — pendente
5. Usuários, notícias, SEO, testes — pendente

As seções ainda sem integração mostram "Sem dados ainda": nenhum dado fictício é exibido.

## Publicar (GitHub + Vercel)

1. Crie um repositório vazio no GitHub e envie o código:
   ```bash
   git remote add origin https://github.com/SEU_USUARIO/cs2-hub.git
   git push -u origin main
   ```
2. No Vercel: **Add New → Project → importe o repositório**. Não mude nada (o `vercel.json` já define build, pasta `frontend` e rotas).
3. Em **Settings → Environment Variables**, cadastre as variáveis do `.env.example` (ex.: `ADMIN_TOKEN`).
4. Deploy. Teste `https://SEU-PROJETO.vercel.app/api/health`.

No Vercel o frontend é servido estático e a API roda como função serverless (`api/index.js`).
Tarefas periódicas (Etapa 2) usarão Vercel Cron ou um worker no Render.
