# �� Bot de Controle de Vendas com IA

Um bot para Telegram que permite registrar e analisar vendas e lucros, com funcionalidades inteligentes fornecidas pelo Google Gemini API.

## ✨ Funcionalidades

- Registro de vendas diárias
- Resumo das vendas do dia
- Total de vendas do mês
- Análise de vendas usando IA (Google Gemini)
- Insights para melhorar as vendas
- Categorização automática de produtos
- Envio automático de resumos diários e semanais

## 🔧 Tecnologias

- Node.js
- [Telegraf](https://github.com/telegraf/telegraf) - Framework moderno para criação de bots Telegram
- [Google Gemini API](https://ai.google.dev/) - IA generativa do Google
- [Node Schedule](https://www.npmjs.com/package/node-schedule) - Agendamento de tarefas

## 🚀 Configuração e Uso

### Pré-requisitos

- Node.js v14+
- Um bot do Telegram (criado via [@BotFather](https://t.me/botfather))
- Uma chave de API do Google Gemini

### Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com:

```
BOT_TOKEN=seu_token_do_telegram
GEMINI_API_KEY=sua_chave_api_gemini
ACTIVE_CHATS=id_do_chat1,id_do_chat2
```

### Instalação

```bash
npm install
npm start
```

## 📋 Comandos

- `/start` - Inicia o bot e mostra a ajuda
- `/resumo` - Exibe o resumo das vendas de hoje
- `/total` - Exibe o total vendido este mês
- `/analise` - Fornece uma análise das suas vendas usando IA
- `/remove [id]` - Remove uma venda específica

## 💡 Como Usar

1. Inicie uma conversa com o bot enviando `/start`
2. Registre uma venda enviando mensagens no formato: `Nome do produto preço`
   - Exemplos: `Café 5.50` ou `Pizza 25`
   - Também pode usar linguagem natural: `Vendi café por 10 reais`

## 🧠 Inteligência Artificial

O bot utiliza o Google Gemini API para:

- **Análise sob demanda**: Use o comando `/analise` para obter insights sobre suas vendas dos últimos 30 dias
- **Resumos semanais**: Receba automaticamente um resumo semanal com análise das suas vendas
- **Sugestões de melhoria**: A IA identifica padrões de vendas e sugere formas de aumentar seus lucros

## 📝 Notas

Este bot armazena dados em memória e é destinado a fins educacionais. Para uso em produção, seria necessário implementar um armazenamento persistente (banco de dados).

## 📄 Licença

Este projeto está licenciado sob a licença MIT.