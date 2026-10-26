# Como instalar a extensão "CRM · WhatsApp (Visão LP)" — v2.10.0

Ela mostra o **card do CRM** ao lado da conversa aberta no **WhatsApp Web** e no **Umbler Talk**.
Nunca envia mensagem sozinha: o texto pronto vai para a caixa de mensagem e você revisa e aperta Enter.

## Antes de começar
- Use o **Google Chrome** no computador (Windows ou Mac).
- Entre pelo **Google** (a conta que você usa no CRM) — ou com e-mail e senha, se preferir.

## 1. Deixar a pasta no computador
1. Baixe o arquivo (sempre a versão mais nova): **https://juca-alt.github.io/crm-captacao/downloads/extensao-whatsapp.zip**
2. Descompacte:
   - **Mac:** dois cliques no zip.
   - **Windows:** botão direito no zip → **Extrair tudo…** → **Extrair**.
3. Vai aparecer a pasta **extensao-whatsapp**. Mova essa pasta para um lugar fixo (ex.: **Documentos**).
   **Não apague depois:** o Chrome lê a extensão dessa pasta.

## 2. Carregar no Chrome
1. Na barra de endereço do Chrome, digite **chrome://extensions** e aperte Enter.
2. Ligue o **Modo do desenvolvedor** (chave no canto superior direito).
3. Clique em **Carregar sem compactação** (canto superior esquerdo).
4. Escolha a pasta **extensao-whatsapp** (a que tem o arquivo `manifest.json` dentro) → **Selecionar pasta**.
5. Deve aparecer o card **"CRM · WhatsApp (Visão LP)"** com a versão **2.10.0**.
6. Opcional: clique no ícone de quebra-cabeça 🧩 da barra do Chrome → 📌 fixar a extensão.

## 3. Usar
1. Abra (ou recarregue com **F5**) o **WhatsApp Web** (web.whatsapp.com) e/ou o **Umbler Talk** (app-utalk.umbler.com).
2. Clique no botão redondo **CRM** no canto direito da tela (ou no ícone da extensão).
3. Na primeira vez em cada site, o card pede login: toque em **Entrar com Google** — abre uma janelinha do Google, escolha a
   sua conta e pronto. (Também dá com e-mail e senha; criar/trocar a senha: no CRM, botão **🔑 Senha** no topo.)
4. Abra uma conversa: o card da pessoa aparece sozinho.
   - **Umbler, contato salvo:** abra **Detalhes do contato** (👤 no topo da conversa) para o card achar pelo telefone.
   - Pessoa não encontrada: o card sugere nomes parecidos; ao escolher, a conversa fica ligada (📌) e da próxima vez abre direto.
5. **💬 Mensagem pronta** no card: o texto vai para a caixa da conversa. Revise e aperte Enter.

## 4. Relatórios do portal (2.10.0, no computador)
1. Abra o portal da corretora e **entre** (login) normalmente.
2. Clique no **ícone da extensão** na barra do Chrome. Na 1ª vez o Chrome pergunta se pode acessar aquele site → **Permitir**.
3. No painel **📥 Relatórios do portal** (canto de baixo, à direita): **● Gravar** e baixe cada relatório **uma vez**, do jeito de
   sempre. Cada um aparece na lista (dá pra mudar o nome clicando nele). Para sozinho em 15 minutos, ou **■ Parar**.
4. Nas próximas vezes: portal aberto e logado → ícone da extensão → **↻ Puxar** (um) ou **⇣ Puxar todos**. Os arquivos vão
   direto para a **Central de Importações** do CRM (se o CRM não estiver aberto, a extensão abre numa aba).
5. A extensão **nunca guarda senha** nem a sessão do portal. Se aparecer "Sessão do portal expirou", entre de novo no portal e
   clique em Puxar outra vez.

## Atualizar para uma versão nova
1. Substitua o conteúdo da pasta **extensao-whatsapp** pelo do zip novo (mesma pasta, mesmo lugar).
2. Em **chrome://extensions**, clique em **↻** no card da extensão.
3. Dê **F5** no WhatsApp Web e no Umbler.

## Se algo der errado
- **Card não aparece / "O CRM não respondeu":** confira a internet e clique em **↻** na barra escura do painel.
- **Aparece "A extensão foi atualizada…":** dê **F5** na página.
- **"Entrar com Google" não completa:** o Gustavo precisa liberar uma vez o endereço da extensão no Supabase (README 2.9.1).
- **Ainda mostra a versão antiga:** o Chrome está lendo outra pasta. Em chrome://extensions, **Remover** e carregar de novo a pasta certa (passo 2).
