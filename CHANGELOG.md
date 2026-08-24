# Changelog

Todas as mudanças relevantes do MEGA-MD são registradas neste arquivo. O formato segue, de forma simplificada, o Keep a Changelog.

## [Unreleased]

### Added

- Contexto operacional para agentes em `AGENTS.md`.
- Documentação local sanitizada do ambiente em `.env.md`, ignorada pelo Git e sem valores secretos.
- Comandos de imagem `jooj`, `ojjo`, `ascii` e `triggered`, inspirados nos efeitos do LorittaBot e implementados localmente com Sharp.
- Pipeline compartilhado para baixar fotos e figurinhas estáticas, limitar entradas e gerar efeitos sem APIs externas.
- Comandos locais `tobecontinued` e `perdao`, com processamento e composição sem serviço externo.
- Comandos locais `sam` e `contentawarescale`, com selo vetorial e seam carving executado no próprio bot.
- Comandos locais `gay`, `perfeito` e `petpet`, com filtro arco-íris sutil, composição estática e animação geradas sem APIs externas.
- Comandos locais `morrepraga`, `susto` e `ripvida`, usando templates do Loritta e composição local de uma imagem.
- Comandos locais `ednaldotv`, `bolsonaro` e `studiopolistv`, com substituição local das telas dos templates.
- Comandos locais `bolsonaro2`, `ata` e `riptv`, com encaixes recortados para telas em perspectiva.
- Comandos locais `deus`, `bobfire` e `bolsoframe`, com composição de uma foto em templates clássicos.
- Comandos locais `passingpaper`, `briggscover` e `buckshirt`, com recortes locais e repetição da estampa quando necessário.

### Changed

- Comando `invert` passou a processar fotos e figurinhas estáticas localmente com Sharp, sem arquivos temporários nem API externa.
- Comando `tobecontinued` passou a usar o overlay transparente fornecido para o meme, mantendo o processamento sépia local.
- Overlay do `tobecontinued` reduzido e aproximado do canto inferior direito.
- Comandos locais de imagem passaram a aceitar a foto de perfil da primeira pessoa mencionada, com orientação neutra quando nenhuma imagem está disponível.
- Comando `sam` passou a usar o overlay transparente fornecido no lugar do selo vetorial gerado.
- Comando `petpet` passou a usar os cinco quadros do GIF transparente fornecido no lugar da mão vetorial gerada.
- Filtro do comando `gay` ficou mais visível, aumentando a opacidade da bandeira de 14% para 22%.
- Telas de `ednaldotv`, `bolsonaro` e `studiopolistv` passaram a esticar a imagem sem recorte; o encaixe inferior do `bolsonaro` também foi reduzido em 4 px.

## [2026-08-23]

### Added

- Bancos de piadas internas vinculáveis a grupos, com aliases `bancopiadas`, `bpiadas` e `insidejokes`.
- Cadastro direto de piadas com tags e contexto no formato `<tags> | <contexto>`.
- Matching sem distinção de caixa ou acentos e seleção de todos os contextos compatíveis.
- Correlação de outras piadas do mesmo banco como referências de estilo quando um gatilho casa.
- Suporte do chatbot a imagens acionadas explicitamente por menção, resposta ou contexto interno.
- Suporte do `.vision` a figurinhas estáticas convertidas de WebP para PNG.
- Alias `toimg` para `.s2img`.
- Aliases `everson` e `everton` para `tagall/everyone`.
- Compatibilidade ampliada com identidades WhatsApp PN/LID/JID e device suffix.

### Changed

- Removido o fluxo guiado de cadastro de piadas; o cadastro direto é o único modo suportado.
- Chatbot ajustado para tom mais natural, menos sarcástico e menos provocativo.
- Flerte passou a ser apenas reativo, leve e condicionado a sinal explícito do usuário.
- Respostas curtas e risadas não devem gerar perguntas forçadas.
- Piadas internas passaram a ter prioridade comportamental no prompt quando uma tag casa.
- Prompt de piadas passou a evitar tarefas banais, memes, screenshots e punchlines genéricas.
- Imagens comuns deixaram de acionar o chatbot automaticamente.
- Tooltips, traduções, menus e ajuda passaram a exibir somente um prefixo válido do ambiente.
- Produção passou a acompanhar a branch `main` após integração da feature.

### Fixed

- Autorização owner/sudo em grupos com alternância entre PN, LID e JID.
- Matching de participantes com IDs bare, `@lid`, `@s.whatsapp.net` e sufixos de dispositivo.
- Retorno não booleano em `isOwnerOnly`.
- Exposição de raciocínio interno e tamanho excessivo em respostas de visão.

## [2026-08-22]

### Added

- Comando Groq Vision para análise de imagens.
- Configuração de modelo, tamanho, tokens e instruções do chatbot via ambiente.
- Integração Last.fm com cartão de faixa recente.
- Sistema de citações/quotely com preservação de respostas, ordem, avatares e agrupamento.

### Changed

- Separação entre proprietário do bot e metadados de autor/pacote de figurinha.
- Repositório e links de atualização alinhados ao fork `junglivre/MEGA-MD`.

### Fixed

- Formatação e limitação das respostas de visão.
- Substituição de menções LID por nomes de exibição quando disponíveis.

## Notas de manutenção

- Não registre segredos, tokens, números privados ou conteúdo de `.env.md` neste changelog.
- Mudanças de prompt devem informar o efeito comportamental pretendido.
- Mudanças de produção devem informar branch/processo somente quando operacionalmente relevante.
