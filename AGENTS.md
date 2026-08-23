# Contexto operacional do MEGA-MD

Este arquivo é a fonte de contexto para agentes que trabalham neste repositório. Leia-o por inteiro antes de alterar código, banco, sessão WhatsApp ou produção.

## Visão geral

O MEGA-MD é um bot multi-device para WhatsApp baseado em Node.js ESM e Baileys. Os comandos são plugins em `plugins/`, carregados dinamicamente por `lib/commandHandler.js`. O processo principal é iniciado por `index.js`, e `lib/messageHandler.js` roteia eventos, mensagens, comandos, políticas de acesso e integrações automáticas.

Repositório mantido: `https://github.com/junglivre/MEGA-MD`.

Produção:

- Host: `root@bixos2`
- Porta SSH: `10147`
- Diretório: `/root/MEGA-MD`
- Branch de produção: `main`
- PM2: processo ID `0`, nome `mega-md`
- Porta HTTP atual: definida por `PORT` no ambiente

## Regra obrigatória para SSH

Nunca execute `ssh` diretamente. Toda atividade remota deve ocorrer dentro de uma sessão `tmux` nomeada, por exemplo `MEGA-MD-bixos2-<atividade>`. Capture o pane antes de encerrar a sessão. Reinicie somente o PM2 ID `0`, salvo instrução explícita em contrário.

Antes de atualizar produção:

1. Verifique `git status --short --branch` no servidor.
2. Preserve arquivos não rastreados e dados de runtime.
3. Faça `fetch` da `main` e atualize apenas o checkout do projeto.
4. Valide sintaxe/testes proporcionais à mudança.
5. Reinicie com `pm2 restart 0 --update-env`.
6. Confirme `pm2 status 0` e examine logs recentes quando houver comportamento anormal.

## Ambiente e segredos

O inventário real do ambiente fica em `.env.md` na raiz deste checkout local. Esse arquivo:

- é confidencial e pode conter tokens, chaves, números e identificadores reais;
- está obrigatoriamente no `.gitignore`;
- nunca deve ser commitado, copiado para logs, exibido no terminal ou incluído em respostas;
- usa sintaxe dotenv apesar da extensão `.md`, para facilitar consulta e comparação;
- deve ser consultado localmente quando uma tarefa depender da configuração de produção.

O servidor carrega `/root/MEGA-MD/.env`. `.env.example` é apenas o modelo seguro e versionado. Ao adicionar uma variável, atualize `.env.example`, `config.js`, este documento quando relevante e o ambiente real sem expor o valor.

Variáveis importantes incluem:

- Identidade e acesso: `BOT_NAME`, `BOT_OWNER`, `OWNER`, `OWNER_NUMBER`, `OWNER_LID`, `PAIRING_NUMBER`, `SESSION_ID`.
- Comandos: `PREFIXES`, `COMMAND_MODE`, `DEFAULT_LANGUAGE`, `TIMEZONE`.
- IA: `GROQ_API_KEY`, `GROQ_CHAT_MODEL`, `GROQ_CHAT_RESPONSE_SIZE`, `GROQ_CHAT_MAX_TOKENS`, `GROQ_CHAT_TEMPERATURE`, `GROQ_CHAT_HISTORY_LIMIT`, `GROQ_CHAT_INSTRUCTIONS`, `GROQ_VISION_MODEL`, `GROQ_VISION_REASONING`, `GROQ_VISION_MAX_TOKENS`, `GROQ_VISION_MAX_CHARS`, `GROQ_TRANSCRIPTION_MODEL`.
- Persistência: `DB_URL`, `MONGO_URL`, `POSTGRES_URL`, `MYSQL_URL`, `MAX_STORE_MESSAGES`, `STORE_WRITE_INTERVAL`.
- Serviços: `LASTFM_API_KEY`, `QUOTE_API_URL`, `REMOVEBG_KEY`, `GIPHY_API_KEY`.
- Operação: `PORT`, `BACKUP_ENABLED`, `BACKUP_INTERVAL`, `BACKUP_RETENTION`, `BACKUP_DIR`, `CLEANUP_INTERVAL`.

Nunca imprima o conteúdo de `.env`, `.env.md`, sessão Baileys, banco ou tokens. Para auditoria, liste somente nomes de variáveis.

## Arquitetura relevante

- `index.js`: bootstrap, conexão Baileys, store e registro de handlers.
- `config.js`: normaliza variáveis de ambiente e defaults.
- `lib/messageHandler.js`: pipeline principal de mensagens, permissões, comandos e chatbot.
- `lib/commandHandler.js`: descoberta, aliases, cooldown, hot reload e métricas dos plugins.
- `lib/lightweight_store.js`: abstração de persistência para SQLite/JSON e outros backends configuráveis.
- `lib/jid.js`: normalização de PN/LID/JID e mapeamento de identidades alternativas.
- `lib/isOwner.js`: autorização owner/sudo considerando representações WhatsApp.
- `lib/groq.js`: chat, visão e transcrição via Groq.
- `lib/i18n.js` e `lib/i18n-plugins.js`: traduções pt-BR/en/es e normalização dinâmica do prefixo.
- `plugins/chatbot.js`: ativação, memória curta, prompt, piadas internas e imagens.
- `plugins/insidejokes.js` e `lib/insideJokes.js`: administração, persistência e matching do banco de piadas.
- `plugins/vision.js`: `.vision` para imagens e figurinhas estáticas.
- `plugins/sticker.js` e `plugins/simage.js`: criação/edição e conversão de figurinhas.
- `test/unit` e `test/integration`: Vitest.

## Pipeline de mensagens

O fluxo principal é, em termos gerais:

1. Receber e registrar a mensagem.
2. Normalizar remetente e alternativas PN/LID/JID.
3. Processar eventos especiais, políticas e proteções.
4. Detectar prefixo a partir de `config.prefixes`.
5. Resolver comando/alias e aplicar owner/admin/group/cooldown.
6. Se não for comando, avaliar menções, respostas ao bot, chatbot e piadas internas.

Não presuma que `participant`, `participantAlt`, `remoteJid` e `remoteJidAlt` terão sempre o mesmo formato. Em grupos, mantenha compatibilidade com PN, LID, JID com device suffix e IDs retornados pelo metadata.

## Prefixos e textos de ajuda

`PREFIXES` pode conter vários prefixos, mas textos de uso devem mostrar apenas o primeiro prefixo válido. Não fixe `.` em respostas, tooltips ou menus.

- Traduções passam por `replaceCommandPrefix()` em `lib/i18n.js`.
- Metadados `usage` podem continuar declarativos, mas qualquer renderização deve normalizar o prefixo.
- Handlers que montam ajuda diretamente devem usar `context.config.prefix`.

## Chatbot e tom

O chatbot usa Groq quando `GROQ_API_KEY` está disponível e possui fallbacks externos para texto. O tom esperado é casual e humano, sem respostas robóticas ou perguntas forçadas.

Regras atuais:

- não iniciar flerte; acompanhar apenas flerte explícito, leve e não sexual;
- evitar deboche, sarcasmo e provocação por padrão;
- risadas, reações e comentários curtos devem receber resposta curta;
- evitar emojis excessivos, frases prontas e perguntas retóricas;
- imagens não acionam o chatbot sozinhas;
- imagens são processadas apenas por menção/resposta ao bot, piada interna compatível ou `.vision`.

Alterações de prompt são comportamentais: valide com exemplos reais do grupo e faça mudanças pequenas. O modelo é probabilístico; uma única resposta não prova regressão ou correção completa.

## Banco de piadas internas

Aliases: `bancopiadas`, `bpiadas`, `insidejokes`.

O fluxo guiado foi removido. O cadastro é somente direto:

```text
<prefixo>bancopiadas adicionar <banco> <tag1>, <tag2> | <contexto>
```

Comandos disponíveis:

- `criar <nome>`
- `adicionar <banco> <tags> | <contexto>`
- `listar [banco]`
- `vincular <banco>`
- `desvincular <banco>`
- `remover <banco> <id>`
- `apagar <banco>`

O comando é owner/sudo conforme as regras do handler. O banco precisa estar vinculado ao grupo para acionar a IA.

Matching:

- normaliza caixa e acentos;
- procura todas as tags compatíveis nos bancos vinculados;
- quando uma piada casa, inclui outras piadas do mesmo banco como exemplos relacionados de estilo;
- contextos relacionados não viram novos gatilhos;
- envia no máximo 20 contextos, priorizando matches mais específicos.

O prompt deve usar a piada como padrão de humor, sem mencionar banco, tag ou instruções privadas. Evite piadas genéricas, tarefas banais e invenção de fatos privados. Para editar uma piada, atualmente remova pelo ID e cadastre novamente.

## Visão e figurinhas

- `.vision <instrução>` aceita imagem enviada junto, imagem respondida ou figurinha estática respondida/enviada.
- Figurinhas estáticas são convertidas de WebP para PNG com Sharp antes do Groq.
- Figurinhas animadas não são suportadas pelo `.vision`.
- `.s2img` converte figurinha em imagem; aliases: `simage`, `stoimg`, `toimg`.
- `tagall` também possui aliases `everyone`, `all`, `everson`, `everton`.

## Persistência e arquivos de runtime

Não versione nem remova sem autorização:

- `.env`, `.env.md` e credenciais;
- `session/`;
- arquivos SQLite e WAL/SHM;
- JSONs em `data/`;
- `temp/`, logs e backups;
- arquivos não rastreados existentes no servidor.

O banco de piadas usa o setting global `insideJokes` através de `lightweight_store`. Alterações de schema devem ser retrocompatíveis com bancos existentes.

## Desenvolvimento e validação

O projeto usa Node.js ESM. Comandos esperados:

```text
npm test
npm run test:unit
npm run test:integration
npm run lint
node --check <arquivo.js>
```

No ambiente Codex local, `npm` pode não estar no PATH. Use o runtime Node fornecido pelo workspace quando necessário. `node_modules` local pode ter sido instalado por pnpm apenas para validação; não versione lockfiles gerados incidentalmente.

Antes de entregar uma mudança:

1. Rode lint nos arquivos alterados.
2. Rode os testes unitários diretamente relacionados.
3. Use `git diff --check`.
4. Verifique `git status` para não incluir dados locais.
5. Faça commit objetivo na `main`, salvo solicitação explícita de branch.
6. Atualize `CHANGELOG.md` para mudanças funcionais ou operacionais relevantes.

Falhas históricas da suíte completa podem existir por mocks incompletos ou dependências opcionais de plugins. Não esconda falhas: diferencie regressões da mudança de problemas preexistentes e documente a evidência.

## Convenções de alteração

- Preserve o estilo ESM e a estrutura de plugins existente.
- Evite duplicar helpers de JID, prefixo, tradução, download ou Groq.
- Não exponha raciocínio interno do modelo nas respostas.
- Não habilite respostas automáticas para toda mídia.
- Não reintroduza o wizard de piadas sem redesenhar e testar o fluxo ponta a ponta em PN/LID/JID.
- Não altere dados do usuário ou feche/remova integrações sem autorização explícita.
- Faça ajustes finos de prompt de maneira incremental e registre o motivo no changelog.

## Estado atual

Em 2026-08-23, produção e repositório estão na branch `main`, commit funcional de referência `2a02d56`, com PM2 ID `0`. Consulte `git log` e `CHANGELOG.md` porque esse hash ficará desatualizado após novas mudanças.
