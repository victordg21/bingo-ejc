# Bingo EJC

Aplicativo web para operar um bingo de festa de igreja: 1000 cartelas físicas (códigos 0001–1000), cada uma com 15 números únicos do intervalo 1–90. O operador chama os números pelo navegador, vê em tempo real quais cartelas estão mais próximas de ganhar e verifica os "BINGO!" gritados pelos jogadores.

Stack: Next.js 14 (App Router), TypeScript, Tailwind CSS.

## Como rodar localmente

```bash
npm install
npm run dev
```

Acesse **http://localhost:3000**.

A primeira vez que abrir o app, o estado começa zerado. Os números chamados são salvos automaticamente no `localStorage` do navegador, então atualizar a página não perde o progresso.

## Como usar durante o jogo

A tela tem três painéis:

1. **Chamar número** (esquerda)
   - Digite o número (1–90) e aperte **Enter** para registrar.
   - Ou clique no número na grade de 90 para alternar (chamado / não chamado).
   - O **último chamado** aparece em letras gigantes — para facilitar a leitura no calor do jogo.
   - **Desfazer** desfaz o último número (caso você digite errado).
   - **Reiniciar jogo** zera tudo (com confirmação).

2. **Ranking ao vivo** (centro)
   - Cartelas ordenadas pelas que estão mais perto de ganhar.
   - **Ganhadoras (0 faltando)** ficam fixadas no topo em **verde**. O jogo continua mesmo depois de uma vitória — vários ganhadores são esperados.
   - **1 número faltando** em amarelo forte. **2 faltando** em amarelo claro.
   - Por padrão mostra as 20 cartelas mais próximas. Botão "Ver todas" expande, e a busca filtra por código.
   - Contador "Ganhadores: N" no topo da tela.

3. **Verificar cartela** (direita)
   - Quando alguém gritar "BINGO!", digite o código da cartela (ex. `0428`) e confirme.
   - Mostra os 15 números da cartela com os já chamados em verde.
   - Diz se a cartela é vencedora e, se não, quais números faltam.
   - Link para baixar todas as cartelas em CSV (para imprimir).

## Geração das cartelas

As 1000 cartelas são geradas com um RNG **determinístico** (seed fixo `0xB1A62026`). O arquivo `data/cards.json` é o único conjunto válido para esta edição do jogo — ele já está no repositório e é o mesmo em desenvolvimento e produção.

Para regenerar (não recomendado se as cartelas já foram impressas):

```bash
npm run generate-cards
```

Isto regrava `data/cards.{json,csv}` e copia para `public/data/` (de onde o app serve o download).

## Imprimir as cartelas

Use o CSV: `data/cards.csv` (também disponível em runtime em `/data/cards.csv` pelo botão "Baixar todas as cartelas").

Formato: uma linha por cartela, colunas `code, n1, n2, ..., n15`.

## Deploy no Vercel

### Opção 1 — CLI (recomendado)

```bash
# Uma vez:
npm i -g vercel

# Login e deploy:
vercel login
vercel deploy --prod
```

O Vercel detecta Next.js automaticamente. Sem variáveis de ambiente necessárias.

### Opção 2 — GitHub + Vercel

1. Crie um repositório no GitHub e dê push.
2. Em [vercel.com/new](https://vercel.com/new) importe o repositório.
3. Aceite os defaults e clique em **Deploy**.

### Notas sobre estado em produção

- As cartelas são bundladas no build (vêm de `data/cards.json` via import estático). Cada deploy carrega o mesmo conjunto.
- O estado do jogo (números chamados) vive **apenas no localStorage do navegador** do operador. Isso é proposital: o app não precisa de banco de dados, e dois operadores em dispositivos diferentes terão estados independentes. Use **um único dispositivo** para conduzir o jogo.

## Estrutura do projeto

```
app/
  layout.tsx        # shell global
  page.tsx          # carrega cards.json e monta o controller
  globals.css       # Tailwind
components/
  BingoController.tsx  # estado central + localStorage
  NumberCaller.tsx     # painel da esquerda
  Ranking.tsx          # painel do centro
  CardLookup.tsx       # painel da direita
lib/
  types.ts
data/
  cards.json        # 1000 cartelas (commitado, fonte da verdade)
  cards.csv         # mesma coisa em CSV (para impressão)
public/data/
  cards.json        # cópia servida ao cliente
  cards.csv         # baixável pelo botão na UI
scripts/
  generate-cards.mjs  # gerador determinístico
```
