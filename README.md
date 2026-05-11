# Bingo EJC

Aplicativo web para operar um bingo de festa de igreja com 1000 cartelas físicas, sorteio ao vivo e acompanhamento em tempo real pelos jogadores via celular.

Três páginas no mesmo deploy:

| Rota     | Quem usa             | Para quê                                                                 |
| -------- | -------------------- | ------------------------------------------------------------------------ |
| `/admin` | Operador (eu)        | Sortear números, cadastrar compradores e gerar QR codes                  |
| `/jogar` | Jogadores no celular | Ver suas cartelas em tempo real, com alertas, confete e som de vitória   |
| `/tv`    | Telão da festa       | Projeção do estado do jogo com últimos sorteados, ganhadores e QR        |

Stack: **Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres + Realtime + RLS)**.

---

## 1. Setup do Supabase (faça isso primeiro)

### 1.1 Criar projeto
1. Vá em **https://supabase.com** e crie uma conta (free tier basta).
2. Clique em **New Project**, defina um nome (ex: `bingo-ejc`) e uma senha de banco. Escolha a região mais perto de você.
3. Aguarde ~1 minuto enquanto o projeto provisiona.

### 1.2 Rodar o schema
1. No projeto recém-criado, abra **SQL Editor** (menu lateral).
2. Clique em **New query**.
3. Copie o conteúdo de [`supabase/schema.sql`](./supabase/schema.sql) e cole.
4. Clique em **Run**. Deve dizer "Success. No rows returned."

Isso cria as tabelas `game_state` e `buyers`, habilita Realtime nelas e configura Row Level Security.

### 1.3 Pegar as credenciais
Em **Project Settings → API**:

- **Project URL** → vira `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** → vira `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** (clique em "reveal") → vira `SUPABASE_SERVICE_ROLE_KEY` (⚠️ secreta, nunca exponha)

---

## 2. Rodar localmente

```bash
npm install
cp .env.example .env.local
# edite .env.local com as credenciais Supabase e uma ADMIN_PASSWORD
npm run dev
```

Abra **http://localhost:3000** — você verá a landing page com 3 botões.

| Rota     | URL local                       |
| -------- | ------------------------------- |
| Landing  | http://localhost:3000           |
| Admin    | http://localhost:3000/admin     |
| Jogador  | http://localhost:3000/jogar     |
| Telão    | http://localhost:3000/tv        |

Na primeira vez em `/admin` você cai em `/admin/login` — digite a senha do `.env.local`. Cookie httpOnly válido por 24h.

---

## 3. Deploy no Vercel

### 3.1 Push para GitHub
Já está em **https://github.com/victordg21/bingo-ejc**.

### 3.2 Importar no Vercel
1. Vá em **https://vercel.com/new** e logue com GitHub.
2. Importe o repo `victordg21/bingo-ejc`.
3. **Framework preset**: Next.js (auto-detectado).
4. **Environment Variables** — adicione as 4 abaixo antes de fazer Deploy:

| Variável                          | Valor                          | Onde                  |
| --------------------------------- | ------------------------------ | --------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`        | Project URL do Supabase        | Production + Preview  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | anon public key                | Production + Preview  |
| `SUPABASE_SERVICE_ROLE_KEY`       | service_role key (secreta)     | Production + Preview  |
| `ADMIN_PASSWORD`                  | senha que você quiser          | Production + Preview  |

5. Clique em **Deploy**. ~60s.

### 3.3 Deploy via CLI (alternativo)

```bash
npm i -g vercel
vercel login
vercel link              # liga o diretório atual ao projeto Vercel
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add ADMIN_PASSWORD
vercel deploy --prod
```

---

## 4. Como usar durante a festa

### Fluxo do operador (no laptop/tablet)
1. Abra `/admin`, digite a senha.
2. Na seção **Compradores** (parte de baixo), cadastre cada comprador:
   - Nome → "João Silva"
   - Cartelas → cole os códigos: `428, 731, 902` ou `100-105` (ranges OK)
   - Clique em **Cadastrar e gerar código**
3. Aparece um card com QR code + código de acesso (ex: `JOAO-7K2P`).
4. Clique em **Imprimir / Compartilhar** para abrir uma janela de impressão com o QR grande — você imprime ou mostra na tela para o comprador escanear.
5. Quando o jogo começar, sorteie os números:
   - Digite no campo + Enter (rápido, sem confirmação)
   - Ou clique no grid 1–90 (pede confirmação)
6. O ranking ao vivo mostra cartelas mais próximas de ganhar.
7. Quando alguém gritar BINGO, use a seção **Verificar cartela** para validar.

### Fluxo do jogador (no celular)
1. Escaneia o QR code → abre `/jogar?code=JOAO-7K2P` e entra automaticamente.
2. Vê suas cartelas em tempo real. A cada número sorteado:
   - A tela atualiza sozinha em < 1 segundo.
   - Se uma cartela ficar a 1 número de vencer: vibra, toca alerta, banner amarelo pulsante.
   - Se vencer: confete, som de vitória, vibração longa, modal "BINGO!".
3. A tela tenta ficar acesa via Wake Lock API (mantenha o celular plugado se a festa for longa).
4. Se o som não funcionar, há um botão "🔊 Ativar sons" no topo (alguns navegadores móveis bloqueiam autoplay até a primeira interação).

### Fluxo do telão (TV/projetor)
1. Abra `/tv` no navegador, ative tela cheia (F11).
2. Mostra: número grande à esquerda, grid 1–90 ao centro, contadores e últimos ganhadores à direita, QR para `/jogar` no rodapé.
3. Atualiza sozinho via Realtime.

---

## 5. Estrutura do projeto

```
app/
  page.tsx                   landing com 3 botões
  layout.tsx                 viewport meta + Tailwind global
  admin/
    page.tsx                 painel admin (server: passa cards)
    login/page.tsx           form de senha
    login/LoginForm.tsx
  jogar/page.tsx             página do jogador
  tv/page.tsx                modo telão
  api/
    admin/login/route.ts     POST → autentica e seta cookie HMAC
    admin/logout/route.ts
    admin/game/{call,toggle,undo,reset}/route.ts   service_role writes
    admin/buyers/route.ts                          GET (lista), POST (cadastrar)
    admin/buyers/[id]/route.ts                     DELETE
    auth/validate-code/route.ts                    valida código do jogador
components/
  AdminClient.tsx            estado realtime + ações via API
  NumberCaller.tsx           painel de sorteio (com modal de confirmação no grid)
  Ranking.tsx                ranking ao vivo
  CardLookup.tsx             verificação de cartela
  BuyerManager.tsx           cadastro + lista de compradores
  QrCard.tsx                 QR + código + botões copiar/imprimir
  JogarClient.tsx            UI completa do jogador (realtime, sons, confete, wake lock)
  JogarLogin.tsx             tela de código
  TvClient.tsx               UI do telão
  ConfirmModal.tsx           confirmação de tap no grid
  ResetGameModal.tsx         confirmação "REINICIAR" digitado
  Toast.tsx                  toast notifications
lib/
  supabase/{browser,server,types}.ts   clients + DB types
  auth.ts                              HMAC-cookie do admin
  rate-limit.ts                        in-memory por IP
  sounds.ts                            Web Audio sintetizado
  access-code.ts                       gerador e parser de códigos
  types.ts                             tipos compartilhados (Card, RankedCard)
middleware.ts                          guarda /admin e /api/admin/*
supabase/
  schema.sql                 cole no SQL editor do Supabase
data/
  cards.json + cards.csv     1000 cartelas determinísticas
public/
  data/cards.{json,csv}      cópia servida ao cliente
scripts/
  generate-cards.mjs         regenera as cartelas (não rode após imprimir!)
```

---

## 6. Segurança

- A rota `/admin` e qualquer `/api/admin/*` (exceto `/api/admin/login`) é guardada pelo middleware que valida um cookie HMAC-SHA256 assinado com `ADMIN_PASSWORD`. TTL 24h.
- `SUPABASE_SERVICE_ROLE_KEY` é usada **apenas** em API routes Node — nunca é enviada ao cliente.
- `/jogar` usa só a anon key. As tabelas têm RLS:
  - `game_state`: leitura pública, escrita só via service_role
  - `buyers`: leitura pública (necessário para validar códigos), escrita só via service_role
- `/api/auth/validate-code` tem rate limit de 10 tentativas/min por IP (in-memory, por Lambda instance — suficiente para uma festa).
- Códigos de acesso: prefixo do primeiro nome + 4 chars de um alfabeto de 32 sem caracteres ambíguos (~1.6M combinações por prefixo). Adequado para um evento.

---

## 7. Cartelas

As 1000 cartelas (códigos `0001`–`1000`, 15 números únicos cada de 1–90) são geradas determinísticamente com seed `0xB1A62026` e ficam em `data/cards.json` (commitado no repo). Para regenerar (⚠️ não faça depois de imprimir):

```bash
npm run generate-cards
```

Para imprimir, use `data/cards.csv` (também baixável em runtime via `/data/cards.csv` no painel admin).

---

## 8. Som

Os sons (alerta de "1 número faltando" e fanfarra de vitória) são **sintetizados via Web Audio API** em `lib/sounds.ts`. Não há arquivos `.mp3` para baixar. Se quiser substituir por sons gravados, troque as funções `playOneAwayAlert()` e `playWinFanfare()` por `new Audio('/sounds/alert.mp3').play()` e coloque os arquivos em `public/sounds/`.

---

## 9. Checklist final antes da festa

- [ ] Schema rodado no Supabase
- [ ] Variáveis de ambiente configuradas no Vercel (4 vars)
- [ ] `ADMIN_PASSWORD` definida (não é o default!)
- [ ] Login em `/admin` funciona
- [ ] Cadastre 1 comprador de teste; abra `/jogar?code=...` em outro dispositivo
- [ ] Sorteie um número; veja `/jogar` e `/tv` atualizando em < 1s
- [ ] Teste numa cartela "1 número faltando" → vibração + alerta
- [ ] Teste vitória completa → confete + modal
- [ ] Ative tela cheia em `/tv` no projetor
