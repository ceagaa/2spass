# 2sPass — Cofre de Senhas Zero-Knowledge (PWA)

Gerenciador de senhas estilo KeePass, com **criptografia ponta-a-ponta (E2EE)** feita
100% no navegador. O servidor (Supabase) armazena **apenas ciphertext** — nunca a
senha mestra, chaves ou dados em texto plano.

> Stack: **React 18 + Vite + TypeScript + Tailwind CSS + Supabase + Web Crypto API + PWA**

---

## 1. Arquitetura de arquivos

```
2spass/
├── index.html                     # shell + fontes + meta PWA
├── vite.config.ts                 # React + Vite PWA (manifest + service worker)
├── tailwind.config.js             # design system (tokens de cor, Inter, raios)
├── supabase/
│   └── schema.sql                 # tabelas + RLS + trigger  (rodar no Supabase)
├── scripts/gen-icons.mjs          # gerador dos ícones PNG do PWA (só Node nativo)
├── public/
│   ├── icon-192.png / icon-512.png / apple-touch-icon.png
│   ├── icon.svg / favicon.svg
└── src/
    ├── main.tsx                   # bootstrap React + registerSW()
    ├── App.tsx                    # providers + roteamento por estado do cofre
    ├── index.css                  # Tailwind + base styles + scrollbars
    ├── lib/
    │   ├── crypto.ts              # ⭐ Argon2id, HKDF, AES-256-GCM, gerador de senha
    │   ├── supabase.ts            # client (sessão volátil em sessionStorage)
    │   ├── backend/
    │   │   ├── types.ts           # contrato Backend (auth + persistência)
    │   │   ├── supabaseBackend.ts # implementação de produção
    │   │   ├── localBackend.ts    # ⭐ modo local sem servidor (IndexedDB)
    │   │   └── index.ts           # escolhe o backend automaticamente
    │   ├── vault.ts               # operações puras do cofre + persistência
    │   ├── storage.ts             # cache offline (IndexedDB) — só ciphertext
    │   ├── clipboard.ts           # copiar com auto-limpeza em 30s
    │   └── types.ts               # VaultData / VaultGroup / VaultItem / VaultCredential + migração
    ├── context/
    │   ├── VaultContext.tsx       # ⭐ estado do cofre, derivação de chave, sync, auto-lock
    │   ├── ToastContext.tsx       # feedback global (copiado, erros…)
    │   └── ThemeContext.tsx       # tema claro/escuro (persistido em localStorage)
    ├── hooks/
    │   └── useAutoLock.ts         # bloqueio por inatividade (robusto a throttling)
    └── components/
        ├── AuthScreen.tsx         # Login / Criar cofre (email + senha mestra)
        ├── UnlockScreen.tsx       # Desbloquear cofre (sessão existente)
        ├── Dashboard.tsx          # layout de 3 colunas + orquestração
        ├── GroupTree.tsx          # árvore recursiva de grupos/subgrupos
        ├── ItemList.tsx           # lista de itens (busca, favoritos)
        ├── ItemDetail.tsx         # item + lista de senhas + “Adicionar outra senha”
        ├── CredentialRow.tsx      # linha da lista (só o identificador; clique abre)
        ├── CredentialDetailModal.tsx # detalhes organizados (usuário/senha/url/notas)
        ├── ItemFormModal.tsx      # criar/editar item (nome + grupo)
        ├── CredentialFormModal.tsx# criar/editar senha (identificador obrigatório)
        ├── PasswordInput.tsx      # campo de senha + gerador + medidor de força
        ├── CopyButton.tsx         # copiar com contagem regressiva
        ├── GroupModal.tsx / ConfirmDialog.tsx # exclusão com confirmação dupla (digitar o nome)
        ├── Toaster.tsx / Logo.tsx / ThemeToggle.tsx
        └── ui/                    # Button.tsx, Input.tsx, Modal.tsx
```

---

## 2. Modelo de segurança (Zero-Knowledge)

```
                         (nunca sai do navegador)
senha mestra ──► Argon2id(password, salt = e-mail) ──► masterKey (32 B)
                                                          │
              ┌───────────────────────────────────────────┤
              │ HKDF(info="supabase-auth")                 │ HKDF(info="vault-encryption", salt=vaultSalt)
              ▼                                            ▼
     authSecret (base64)                          encryptionKey  (AES-256-GCM, não-extraível)
     └─► enviado ao Supabase                        └─► cifra/decifra o cofre inteiro
         (bcrypt no servidor)                           permanece apenas em RAM
```

Pontos-chave:

| Requisito | Implementação |
|---|---|
| Sem senha mestra no servidor | Só o `authSecret` (HKDF de domínio separado) é enviado ao Supabase; **não** decifra o cofre |
| Derivação forte | **Argon2id** (64 MiB, t=3, p=1) via `hash-wasm`; fallback **PBKDF2** (600k, SHA-256) |
| Criptografia local | **AES-256-GCM** com IV aleatório de 12 B por gravação (tag de autenticação detecta tamper) |
| Chave só em memória | `CryptoKey` não-extraível em `useRef`; `masterKeyBytes` é zerado (`fill(0)`) após o uso |
| Sessão volátil | JWT do Supabase em `sessionStorage` (some ao fechar a aba); **nada** de chave em `localStorage` |
| Auto-lock | 5 min de inatividade → limpa chave + cofre da memória (`useAutoLock`) |
| Clipboard | Limpo automaticamente após **30 s** (só se ainda contiver o valor copiado) |
| Confidencialidade no repouso | Supabase/RLS guardam apenas o blob `v1.<iv>.<ciphertext>` |

**Formato do payload cifrado:** `v1.<iv-base64>.<ciphertext-base64>`

**Recuperação:** se a senha mestra for esquecida, os dados são irrecuperáveis — por design.

### Fluxo de autenticação
1. `email` é usado como *salt* público do KDF (permite derivar o `authSecret` **antes** do login, sem oráculo de enumeração).
2. `signUp` / `signInWithPassword` usam o `authSecret` — a senha mestra nunca é transmitida.
3. Após autenticar, busca-se `salt` (aleatório por usuário) e deriva-se a `encryptionKey`.
4. **Entrar / Desbloquear** = sucesso na decifragem (AES-GCM). Senha errada → falha de autenticação do GCM.

---

## 3. Banco de dados (Supabase)

Rode `supabase/schema.sql` no **SQL Editor**. Ele cria a tabela `vaults`
(`id`, `user_id`, `salt`, `kdf_salt`, `encrypted_data`, `data_version`, `updated_at`, `created_at`) com

- **CHECKs** que impedem persistir texto plano ou blob fora do formato
  `v1.<iv>.<ciphertext>` (espelha `crypto.ts::encryptJSON`) e limitam tamanhos;
- um **trigger de imutabilidade**: `id`, `user_id` e `created_at` não mudam e os
  timestamps são sempre do banco (vale até para `BYPASSRLS`);
- **RLS com `force`** (4 policies — `select/insert/update/delete` — só para
  `authenticated`, com `(select auth.uid()) = user_id`);
- **revoke → grant**: `anon` fica sem nada, `authenticated` recebe exatamente as
  4 operações, independente dos *default privileges* do projeto;
- remoção da publication `supabase_realtime` (nunca transmitir eventos da tabela).

O script é **idempotente**: roda em banco novo ou já provisionado (inclui um bloco
`DO` que adiciona os `CHECKs` que faltarem).

> **Authentication → Providers → Email**: ativar *leaked password protection* e
> senha forte. Confirmação de e-mail é recomendada: `supabaseBackend.signUp()`
> devolve `null` quando o Supabase responde sem `session`, então o app para no
> aviso "Confirme seu e-mail…" em vez de tentar o INSERT do cofre sem JWT.

Variáveis de ambiente (`.env`):

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA-ANON-KEY
```

---

## 4. Rodando

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build + service worker (dist/)
npm run preview    # serve o build de produção
```

Instalação PWA: abra o build no Chrome/Edge → ícone “Instalar” na barra de endereço.

### 4.1 Testar sem Supabase (modo local)

**Não é preciso configurar nada.** Sem `.env.local`, o app inicia automaticamente em
**modo local**: contas e cofres cifrados ficam no `IndexedDB` deste navegador (badge
“Modo local” no rodapé). O fluxo é idêntico ao de produção — Argon2id, AES-256-GCM,
auto-lock, lock/unlock, PWA — então serve para validar tudo antes de plugar o backend.

- Usa `localBackend` (`src/lib/backend/localBackend.ts`); a validação da senha mestra
  continua sendo a falha de decifragem do AES-GCM.
- Para forçar o modo local mesmo com o Supabase configurado: `VITE_LOCAL_MODE=1`.
- Os dados de teste **não migram** depois; ao configurar o Supabase você começa com um
  cofre novo (a arquitetura zero-knowledge não permite transpor chaves entre contas).
- Limpar: DevTools → Application → IndexedDB → apague `2spass-local` e `2spass-vault`
  (e o `sessionStorage` para encerrar a sessão).

---

## 5. Funcionalidades

- Hierarquia de **3 níveis: Grupo → Item → N senhas**. Cada **item** (ex.: "Supabase") agrupa
  quantas **credenciais** você quiser; use **“Adicionar outra senha”** no detalhe do item.
- Senhas listadas pelo **identificador (obrigatório)**; **um clique** abre um modal com os
  detalhes organizados — usuário, senha, URL e notas.
- Grupos e **subgrupos** aninhados (árvore recursiva, contador de itens por nó).
- Cada credencial tem **identificador, usuário/e-mail, senha, URL e notas** (tudo cifrado),
  com **visualizar/ocultar**, **copiar** (auto-limpeza 30 s) e **gerador** criptográfico.
- Busca por item/usuário/URL, favoritos por item, exclusão avulsa de senhas e cascata de grupos.
  Toda exclusão (senha, item ou grupo) exige **confirmação dupla**: é preciso digitar o nome exato
  do que será removido para liberar o botão.
- **Migração automática**: cofres do formato antigo (senha única) viram um item com uma
  credencial — sem perda de dados.
- **Tema claro/escuro** com alternância na barra lateral e nas telas de acesso; preferência
  persistida em `localStorage` e aplicada antes da primeira pintura (sem flash). Todo o
  design system é dirigido por variáveis CSS (tokens em `src/index.css` + `tailwind.config.js`).
- **PWA offline**: service worker cacheia o app shell; o cofre cifrado fica no IndexedDB
  e é sincronizado com o Supabase ao reconectar (fila serializada, sem sobrescrita fora de ordem).
- Status de sincronização visível (sincronizado / offline / erro).

---

## 6. Cabeçalhos de segurança recomendados (produção)

Sirva via HTTPS e adicione, no host (ex.: `vercel.json`, Nginx ou Cloudflare):

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data:;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co;
  worker-src 'self' blob:;
  object-src 'none'; base-uri 'self'; frame-ancestors 'none'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: geolocation=(), camera=(), microphone=()
```

> `'wasm-unsafe-eval'` é necessário para o Argon2id em WebAssembly. A verificação de
> integridade do `encrypted_data` é feita pela tag do AES-GCM, então o app **rejeita**
> qualquer ciphertext adulterado.
