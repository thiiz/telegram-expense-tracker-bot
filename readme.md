# 🤖 Bot de Controle de Gastos com IA

Um bot para Telegram que permite registrar e analisar gastos, com funcionalidades inteligentes fornecidas pelo Google Gemini API.

## 🌟 Funcionalidades

- Registro de gastos diários
- Resumo dos gastos do dia
- Total de gastos do mês
- Análise de gastos usando IA (Google Gemini)
- Resumos diários automáticos
- Análises semanais com insights da IA

## 🚀 Como configurar

1. Clone este repositório
2. Instale as dependências:
   ```
   npm install
   ```
3. Crie um arquivo `.env` baseado no `.env.example`:
   ```
   BOT_TOKEN=seu_token_do_telegram
   GEMINI_API_KEY=sua_chave_da_api_gemini
   ACTIVE_CHATS=id_do_chat1,id_do_chat2
   ```

4. Obtenha um token de bot do Telegram falando com [@BotFather](https://t.me/BotFather)
5. Obtenha uma chave gratuita para a API Gemini em [Google AI Studio](https://ai.google.dev/)
6. Execute o bot:
   ```
   node index.js
   ```

## 📦 Dependências

- dotenv
- telegraf
- node-schedule
- @google/generative-ai

## 📝 Comandos disponíveis

- `/start` - Exibe a mensagem de ajuda
- `/resumo` - Exibe o resumo dos gastos de hoje
- `/total` - Exibe o total gasto este mês
- `/analise` - Fornece uma análise dos seus gastos usando IA

## 🔍 Como usar

1. Inicie uma conversa com o bot
2. Registre um gasto enviando mensagens no formato: `Nome do produto preço`
   - Exemplo: `Café 5.50` ou `Pizza 25`
3. Use os comandos para obter resumos e análises

## 🤖 Recursos da IA (Gemini)

- **Análise sob demanda**: Use o comando `/analise` para obter insights sobre seus gastos dos últimos 30 dias
- **Resumo semanal com IA**: Todo domingo às 18h, o bot enviará automaticamente um resumo semanal com insights gerados por IA
- **Sugestões de economia**: A IA identifica padrões de gastos e sugere formas de economizar