# AI Context Bridge (LinkedIn)

Extensão **Chrome (MV3)** + App externo (Vite/React) que:

- captura contexto do post quando você foca num campo de comentário do LinkedIn
- envia esse contexto para um **Side Panel**
- gera uma resposta via **OpenRouter**
- injeta o texto gerado de volta no editor (com eventos de `input/change`)

## Estrutura

- `web/`: App React + Vite + Tailwind (UI do side panel)
- `extension/`: Chrome Extension MV3 (content script + background + side panel host)
- `api/`: Serverless Function (Vercel) para chamada ao OpenRouter

## Rodando local (dev)

### 1) App web

```bash
cd web
npm install
npm run dev
```

Isso sobe o app em `http://localhost:5173`.

### 2) Extensão

1. Chrome  `chrome://extensions`
2. Ative **Developer mode**
3. **Load unpacked**  selecione a pasta `extension/`
4. Abra o LinkedIn e clique no ícone da extensão (ou abra o side panel)
5. No topo do side panel, mantenha o App como `http://localhost:5173` e clique **Save**

## Deploy na Vercel

Este repo já está pronto para deploy com `vercel.json`:

- site estático: `web/`
- function: `api/generate.ts` em `/api/generate`

### Variáveis de ambiente (Vercel)

Configure no projeto da Vercel:

- `OPENROUTER_API_KEY`: sua chave
- `OPENROUTER_MODEL` (opcional): default `openai/gpt-4o-mini`

> Importante: **não cole** a chave dentro do código, nem em `README`, nem em arquivos comitados. Trate como segredo.
> Se você já expôs a chave (por exemplo, colando em chat), **revogue e gere outra** no OpenRouter.

## Rodando local com a API (OpenRouter)

O Vite (`npm run dev` em `web/`) **não** serve as rotas `api/*`. Para testar a geração localmente, use o runtime da Vercel:

```bash
npm i -g vercel
vercel dev
```

E defina as env vars no seu terminal (PowerShell), por exemplo:

```powershell
$env:OPENROUTER_API_KEY="sua_chave_aqui"
$env:OPENROUTER_MODEL="openai/gpt-4o-mini"
vercel dev
```

Depois abra o app na URL que o `vercel dev` imprimir.

## Como funciona (arquitetura de isolamento)

- **Content Script (`extension/contentScript.js`)**: detecta foco no editor e extrai contexto via heurísticas + `closest()`.
- **Background SW (`extension/background.js`)**: recebe contexto, cacheia por tab, e repassa para o side panel.
- **Side Panel Host (`extension/sidepanel.html` + `sidepanel.js`)**: carrega o app externo em um `iframe` e faz ponte via `postMessage`.
- **Web App (`web/`)**:
  - recebe `AICB_POST_CONTEXT` via `window.postMessage`
  - chama `/api/generate`
  - emite `AICB_INSERT_TEXT` via `window.parent.postMessage` para injeção na tab ativa

## Notas

- O LinkedIn muda DOM frequentemente: a extração é **heurística** e intencionalmente evita seletores ultra-frágeis.
- Se o botão Publicar ficar cinza, normalmente é falta de disparo de eventos  a injeção já dispara `input` e `change`.