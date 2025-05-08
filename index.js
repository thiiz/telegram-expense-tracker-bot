require('dotenv').config();
const { Telegraf, Telegram } = require('telegraf');
const schedule = require('node-schedule');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Configuração do Bot
const bot = new Telegraf(process.env.BOT_TOKEN);
const telegram = new Telegram(process.env.BOT_TOKEN);

// Configuração do Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Armazenamento simples para gastos (em memória)
// Em uma aplicação real, você usaria um banco de dados
const expensesStorage = {};
const expenseIdCounter = {}; // Contador de IDs por chat

// Comando de início
bot.start((ctx) => {
  ctx.reply(
    'Bem-vindo ao Bot de Controle de Gastos! 💰\n\n' +
    'Para registrar um gasto, você pode:\n' +
    '• Usar formato simples: "Café 5.50" ou "Pizza 25"\n' +
    '• Usar linguagem natural: "Gastei 35 com jantar" ou "Paguei 12,50 pelo almoço"\n\n' +
    'Use os botões abaixo ou os comandos:\n' +
    '/start - Exibe esta mensagem de ajuda\n' +
    '/resumo - Exibe o resumo dos gastos de hoje\n' +
    '/total - Exibe o total gasto este mês\n' +
    '/analise - Análise dos seus gastos recentes usando IA\n' +
    '/remove [id] - Remove um gasto pelo seu ID',
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📊 Resumo Diário', callback_data: 'resumo' },
            { text: '💰 Total Mensal', callback_data: 'total' }
          ],
          [
            { text: '🧠 Análise IA', callback_data: 'analise' },
            { text: '❓ Ajuda', callback_data: 'ajuda' }
          ]
        ]
      }
    }
  );
});

// Manipulador para botões de ação
bot.action('resumo', async (ctx) => {
  try {
    await ctx.answerCbQuery('Buscando resumo diário...');

    const chatId = ctx.chat.id.toString();
    const expenses = getExpensesFromStorage(chatId, 1);

    if (expenses.length === 0) {
      return ctx.editMessageText('Você não registrou nenhum gasto hoje.', getMainKeyboard());
    }

    const summary = formatExpensesSummary(expenses);
    ctx.editMessageText(summary, getResumoKeyboard());
  } catch (error) {
    console.error('Erro ao buscar resumo:', error);
    ctx.answerCbQuery('Ocorreu um erro. Tente novamente.');
  }
});

bot.action('total', async (ctx) => {
  try {
    await ctx.answerCbQuery('Calculando total mensal...');

    const today = new Date();
    const daysInCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const currentDay = today.getDate();
    const daysToFetch = Math.min(30, currentDay);

    const chatId = ctx.chat.id.toString();
    const expenses = getExpensesFromStorage(chatId, daysToFetch);

    if (expenses.length === 0) {
      return ctx.editMessageText('Você não registrou nenhum gasto este mês.', getMainKeyboard());
    }

    const total = expenses.reduce((sum, expense) => sum + expense.price, 0);
    ctx.editMessageText(`Total gasto neste mês: R$ ${total.toFixed(2)}`, getMainKeyboard());
  } catch (error) {
    console.error('Erro ao calcular total:', error);
    ctx.answerCbQuery('Ocorreu um erro. Tente novamente.');
  }
});

bot.action('analise', async (ctx) => {
  try {
    // Responde ao callback imediatamente
    await ctx.answerCbQuery();
    await ctx.editMessageText('🧠 Analisando seus gastos... Aguarde um momento.', getMainKeyboard());

    const chatId = ctx.chat.id.toString();
    const expenses = getExpensesFromStorage(chatId, 30);

    if (expenses.length === 0) {
      return ctx.editMessageText('Você não possui gastos registrados para análise.', getMainKeyboard());
    }

    const expensesData = expenses.map(e => `${e.product}: R$ ${e.price.toFixed(2)}`).join('\n');
    const total = expenses.reduce((sum, e) => sum + e.price, 0);

    const prompt = `
Analise os seguintes gastos de um usuário nos últimos 30 dias:

${expensesData}

Total: R$ ${total.toFixed(2)}

Forneça:
1. Uma análise concisa dos padrões de gastos
2. Sugestões para possíveis economias
3. Categorias com maior gasto

Responda em português, de forma amigável e objetiva, em até 500 caracteres.
Não formate sua resposta com markdown ou blocos de código.
`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    ctx.editMessageText(`📊 *Análise de Gastos* 📊\n\n${response}`, {
      parse_mode: 'Markdown',
      ...getMainKeyboard()
    });
  } catch (error) {
    console.error('Erro ao gerar análise com IA:', error);
    ctx.editMessageText('Não foi possível gerar a análise neste momento. Tente novamente mais tarde.', getMainKeyboard());
  }
});

bot.action('ajuda', async (ctx) => {
  await ctx.answerCbQuery('Exibindo ajuda...');
  ctx.editMessageText(
    'Como usar o Bot de Controle de Gastos 💰\n\n' +
    '1️⃣ *Para registrar um gasto*:\n' +
    'Você pode usar um dos seguintes formatos:\n' +
    '• Formato simples: "Café 5.50" ou "Pizza R$25"\n' +
    '• Linguagem natural: "Gastei 15 com almoço" ou\n' +
    '  "Paguei 45 reais pelo Uber hoje"\n\n' +
    '2️⃣ *Para ver o resumo diário*:\n' +
    'Clique no botão "📊 Resumo Diário" ou use /resumo\n\n' +
    '3️⃣ *Para ver o total mensal*:\n' +
    'Clique no botão "💰 Total Mensal" ou use /total\n\n' +
    '4️⃣ *Para análise de gastos com IA*:\n' +
    'Clique no botão "🧠 Análise IA" ou use /analise\n\n' +
    '5️⃣ *Para remover um gasto*:\n' +
    'Use o comando /remove [id] ou use o botão ❌\n' +
    'após registrar um gasto',
    {
      parse_mode: 'Markdown',
      ...getMainKeyboard()
    }
  );
});

// Função para obter o teclado principal
function getMainKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📊 Resumo Diário', callback_data: 'resumo' },
          { text: '💰 Total Mensal', callback_data: 'total' }
        ],
        [
          { text: '🧠 Análise IA', callback_data: 'analise' },
          { text: '❓ Ajuda', callback_data: 'ajuda' }
        ]
      ]
    }
  };
}

// Mantendo comandos originais
// Comando para obter resumo
bot.command('resumo', async (ctx) => {
  try {
    const chatId = ctx.chat.id.toString();
    const expenses = getExpensesFromStorage(chatId, 1);

    if (expenses.length === 0) {
      return ctx.reply('Você não registrou nenhum gasto hoje.', getMainKeyboard());
    }

    const summary = formatExpensesSummary(expenses);
    ctx.reply(summary, getResumoKeyboard());
  } catch (error) {
    console.error('Erro ao buscar resumo:', error);
    ctx.reply('Ocorreu um erro ao buscar o resumo. Tente novamente.', getMainKeyboard());
  }
});

// Comando para obter total do mês
bot.command('total', async (ctx) => {
  try {
    const today = new Date();
    const daysInCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const currentDay = today.getDate();
    const daysToFetch = Math.min(30, currentDay);

    const chatId = ctx.chat.id.toString();
    const expenses = getExpensesFromStorage(chatId, daysToFetch);

    if (expenses.length === 0) {
      return ctx.reply('Você não registrou nenhum gasto este mês.', getMainKeyboard());
    }

    const total = expenses.reduce((sum, expense) => sum + expense.price, 0);
    ctx.reply(`Total gasto neste mês: R$ ${total.toFixed(2)}`, getMainKeyboard());
  } catch (error) {
    console.error('Erro ao calcular total:', error);
    ctx.reply('Ocorreu um erro ao calcular o total. Tente novamente.', getMainKeyboard());
  }
});

// Comando para análise de gastos com IA
bot.command('analise', async (ctx) => {
  try {
    const chatId = ctx.chat.id.toString();
    const expenses = getExpensesFromStorage(chatId, 30);

    if (expenses.length === 0) {
      return ctx.reply('Você não possui gastos registrados para análise.', getMainKeyboard());
    }

    // Prepara os dados para o modelo
    const expensesData = expenses.map(e => `${e.product}: R$ ${e.price.toFixed(2)}`).join('\n');
    const total = expenses.reduce((sum, e) => sum + e.price, 0);

    // Enviando mensagem de aguarde
    const waitingMessage = await ctx.reply('🧠 Analisando seus gastos... Aguarde um momento.', getMainKeyboard());

    // Constrói o prompt para o Gemini
    const prompt = `
Analise os seguintes gastos de um usuário nos últimos 30 dias:

${expensesData}

Total: R$ ${total.toFixed(2)}

Forneça:
1. Uma análise concisa dos padrões de gastos
2. Sugestões para possíveis economias
3. Categorias com maior gasto

Responda em português, de forma amigável e objetiva, em até 500 caracteres.
Não formate sua resposta com markdown ou blocos de código.
`;

    // Obtém análise do Gemini
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Envia a resposta e deleta a mensagem de espera
    await ctx.telegram.deleteMessage(chatId, waitingMessage.message_id);
    ctx.reply(`📊 *Análise de Gastos* 📊\n\n${response}`, {
      parse_mode: 'Markdown',
      ...getMainKeyboard()
    });
  } catch (error) {
    console.error('Erro ao gerar análise com IA:', error);
    ctx.reply('Não foi possível gerar a análise neste momento. Tente novamente mais tarde.', getMainKeyboard());
  }
});

// Processar mensagens de texto (registrar gastos)
bot.on('text', async (ctx) => {
  const text = ctx.message.text;

  // Ignora comandos
  if (text.startsWith('/')) return;

  try {
    // Primeiro tenta o formato padrão
    const match = text.match(/(.+?)\s*(?:R?\$?\s*)?\s*([0-9]+[.,]?[0-9]*)$/i);

    if (match) {
      // Formato padrão detectado, processa normalmente
      let product = match[1].trim();
      // Normaliza o preço (substitui vírgula por ponto)
      const price = parseFloat(match[2].replace(',', '.'));

      await processExpense(ctx, product, price);
    } else {
      // Tenta usar IA para interpretar a entrada em linguagem natural
      await ctx.reply('🧠 Interpretando sua mensagem... Aguarde um momento.');

      const prompt = `
Analise a seguinte mensagem de despesa em português e extraia o item/serviço e o valor:
"${text}"

Exemplos de entradas e suas interpretações:
1. "Gastei com café hoje 5 reais" → item: café, valor: 5
2. "Paguei a conta de luz de 150,90" → item: conta de luz, valor: 150.90
3. "Almocei por 32 reais" → item: almoço, valor: 32
4. "Uber 25" → item: uber, valor: 25
5. "Fiz compras no mercado, deu 175,50" → item: compras mercado, valor: 175.50

Responda APENAS com um JSON no formato:
{
  "item": "nome do item ou serviço",
  "valor": número (com ponto como separador decimal)
}

Se não for possível extrair tanto o item quanto o valor, responda com:
{
  "erro": "Não foi possível identificar o item e valor"
}

IMPORTANTE: Não inclua formatação markdown, blocos de código ou outras marcações. Responda apenas com o objeto JSON puro.
`;

      // Usando Gemini para interpretar a entrada
      const result = await model.generateContent(prompt);
      const aiResponse = result.response.text().trim();

      try {
        // Remover possíveis marcações markdown da resposta
        let cleanResponse = aiResponse;
        if (cleanResponse.includes('```')) {
          // Remove blocos de código, pegando apenas o conteúdo dentro do bloco
          cleanResponse = cleanResponse.replace(/```(?:json)?([^`]*)```/gs, '$1').trim();
        }

        // Tenta analisar a resposta como JSON
        const parsedResponse = JSON.parse(cleanResponse);

        if (parsedResponse.erro) {
          // IA não conseguiu interpretar
          ctx.reply(
            'Não consegui entender sua mensagem. Por favor, use um formato como:\n' +
            '"Café 5.50" ou "Pizza R$25" ou "Almoço R$15,90"',
            getMainKeyboard()
          );
        } else {
          // Extraiu item e valor com sucesso
          const product = parsedResponse.item;
          const price = parsedResponse.valor;

          // Codifica o produto em base64 para evitar problemas com caracteres especiais no callback_data
          const encodedProduct = Buffer.from(product).toString('base64');

          // Confirma com o usuário
          ctx.reply(
            `Entendi que você gastou R$ ${price.toFixed(2)} com "${product}". Está correto?`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '✅ Sim, registrar', callback_data: `confirm_${encodedProduct}_${price}` },
                    { text: '❌ Não, cancelar', callback_data: 'cancel_expense' }
                  ]
                ]
              }
            }
          );
        }
      } catch (error) {
        console.error('Erro ao interpretar resposta da IA:', error);
        ctx.reply(
          'Desculpe, houve um erro ao interpretar sua mensagem. Por favor, tente novamente usando um formato como:\n' +
          '"Café 5.50" ou "Pizza R$25"',
          getMainKeyboard()
        );
      }
    }
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
    ctx.reply('Ocorreu um erro ao processar sua mensagem. Tente novamente.');
  }
});

// Adicionar handlers para confirmação de despesa
bot.action(/confirm_(.+)_([0-9.]+)/, async (ctx) => {
  try {
    await ctx.answerCbQuery('Registrando gasto...');

    // Decodifica o produto de base64
    const encodedProduct = ctx.match[1];
    const product = Buffer.from(encodedProduct, 'base64').toString();
    const price = parseFloat(ctx.match[2]);

    await processExpense(ctx, product, price);

    // Remover a mensagem de confirmação
    await ctx.deleteMessage();
  } catch (error) {
    console.error('Erro ao confirmar despesa:', error);
    ctx.answerCbQuery('Ocorreu um erro. Tente novamente.');
  }
});

bot.action('cancel_expense', async (ctx) => {
  await ctx.answerCbQuery('Operação cancelada');
  await ctx.editMessageText('Operação cancelada. Tente novamente com um formato como:\n"Café 5.50" ou "Pizza R$25"', getMainKeyboard());
});

// Função para processar despesa
async function processExpense(ctx, product, price) {
  try {
    // Formata o nome do produto usando IA antes de salvar
    const prompt = `
    Formate o nome deste item de despesa para ser consistente e organizado: "${product}".
    Use apenas letras minúsculas, corrija erros ortográficos óbvios, e padronize o nome.
    Não adicione informações extras, apenas retorne o nome formatado.
    Exemplos: "cafe" → "café", "refri coca" → "refrigerante coca-cola", "almoço restaurante" → "almoço".
    Responda apenas com o texto formatado, sem explicações.
    `;

    // Usando Gemini para formatar o texto
    const result = await model.generateContent(prompt);
    const formattedProduct = result.response.text().trim();

    // Se o AI retornou algo vazio ou muito diferente, mantém o original
    if (!formattedProduct || formattedProduct.length > product.length * 2) {
      console.log("Usando produto original devido a formatação problemática:", product);
    } else {
      product = formattedProduct;
      console.log("Produto formatado pela IA:", product);
    }

    // Salva a despesa no armazenamento
    const chatId = ctx.chat.id.toString();
    const expense = {
      product,
      price,
      date: new Date()
    };

    const expenseId = saveExpense(chatId, expense);

    ctx.reply(`✅ Registrado: #${expenseId} - ${product} - R$ ${price.toFixed(2)}\n\nPara remover, use /remove ${expenseId}`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📊 Ver Resumo', callback_data: 'resumo' },
            { text: '➕ Adicionar Mais', callback_data: 'adicionar' }
          ],
          [
            { text: '❌ Remover', callback_data: `remove_${expenseId}` }
          ]
        ]
      }
    });
  } catch (error) {
    console.error('Erro ao processar despesa:', error);
    ctx.reply('Ocorreu um erro ao processar sua mensagem. Tente novamente.');
  }
}

// Comando para remover um gasto
bot.command('remove', async (ctx) => {
  try {
    const text = ctx.message.text;
    const params = text.split(' ');

    if (params.length !== 2) {
      return ctx.reply('Uso correto: /remove [id]');
    }

    const expenseId = parseInt(params[1]);
    if (isNaN(expenseId)) {
      return ctx.reply('ID inválido. Use /remove seguido do número ID do gasto.');
    }

    const chatId = ctx.chat.id.toString();

    if (!expensesStorage[chatId] || expensesStorage[chatId].length === 0) {
      return ctx.reply('Não há gastos registrados para remover.');
    }

    const index = expensesStorage[chatId].findIndex(expense => expense.id === expenseId);

    if (index === -1) {
      return ctx.reply(`Não foi encontrado nenhum gasto com ID ${expenseId}.`);
    }

    const removedExpense = expensesStorage[chatId].splice(index, 1)[0];
    ctx.reply(`✅ Removido: ${removedExpense.product} - R$ ${removedExpense.price.toFixed(2)}`);

  } catch (error) {
    console.error('Erro ao remover gasto:', error);
    ctx.reply('Ocorreu um erro ao tentar remover o gasto. Tente novamente.');
  }
});

// Função para salvar uma despesa no armazenamento
function saveExpense(chatId, expense) {
  if (!expensesStorage[chatId]) {
    expensesStorage[chatId] = [];
    expenseIdCounter[chatId] = 0;
  }

  // Incrementa o contador e adiciona ID único para este chat
  expenseIdCounter[chatId]++;
  expense.id = expenseIdCounter[chatId];

  expensesStorage[chatId].push(expense);
  console.log(`Despesa salva para o chat ${chatId}:`, expense);

  return expense.id;
}

// Função para buscar gastos do armazenamento
function getExpensesFromStorage(chatId, daysBack = 1) {
  const expenses = expensesStorage[chatId] || [];
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - daysBack + 1); // +1 para incluir o dia atual
  startDate.setHours(0, 0, 0, 0);

  // Filtra os gastos pela data
  return expenses.filter(expense => {
    const expenseDate = new Date(expense.date);
    return expenseDate >= startDate;
  });
}

// Função para formatar o resumo de despesas
function formatExpensesSummary(expensesList) {
  let summary = '📊 Resumo de Gastos:\n\n';

  expensesList.forEach((expense) => {
    summary += `#${expense.id} - ${expense.product}: R$ ${expense.price.toFixed(2)}\n`;
  });

  const total = expensesList.reduce((sum, expense) => sum + expense.price, 0);
  summary += `\n💰 Total: R$ ${total.toFixed(2)}`;

  return summary;
}

// Atualizar os teclados para as mensagens de resumo
function getResumoKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '💰 Total Mensal', callback_data: 'total' },
          { text: '🧠 Análise IA', callback_data: 'analise' }
        ],
        [
          { text: '➕ Adicionar Gasto', callback_data: 'adicionar' },
          { text: '⬅️ Voltar', callback_data: 'ajuda' }
        ]
      ]
    }
  };
}

// Atualizar os teclados para mensagens de resumo semanal/diário
function getResumoAdditionalButtons(expenses) {
  const buttons = [];

  // Se há muitos gastos, oferece categorização
  if (expenses.length >= 5) {
    buttons.push([{ text: '📊 Categorizar Gastos', callback_data: 'categorizar' }]);
  }

  // Botões padrão
  buttons.push([
    { text: '💰 Ver Total', callback_data: 'total' },
    { text: '➕ Adicionar', callback_data: 'adicionar' }
  ]);

  return {
    reply_markup: {
      inline_keyboard: buttons
    }
  };
}

// Agendamento do resumo semanal com insights da IA
schedule.scheduleJob('0 18 * * 0', async () => {
  // Buscar lista de chats ativos
  const activeChats = process.env.ACTIVE_CHATS ? process.env.ACTIVE_CHATS.split(',') : [];

  for (const chatId of activeChats) {
    try {
      const expenses = getExpensesFromStorage(chatId, 7); // Pega os dados da semana

      if (expenses.length > 0) {
        // Prepara os dados para o modelo
        const expensesData = expenses.map(e => `${e.product}: R$ ${e.price.toFixed(2)}`).join('\n');
        const total = expenses.reduce((sum, e) => sum + e.price, 0);

        // Constrói o prompt para o Gemini
        const prompt = `
Analise os seguintes gastos de um usuário na última semana:

${expensesData}

Total: R$ ${total.toFixed(2)}

Forneça:
1. Um breve resumo dos gastos da semana
2. Uma dica de economia baseada nos padrões de compra
3. Uma previsão para a próxima semana

Responda em português, de forma amigável e concisa, em até 300 caracteres.
`;

        // Obtém análise do Gemini
        const result = await model.generateContent(prompt);
        const aiAnalysis = result.response.text();

        const summary = formatExpensesSummary(expenses);
        await telegram.sendMessage(
          chatId,
          `🌙 Resumo semanal de gastos:\n\n${summary}\n\n💡 *Insights da IA*:\n${aiAnalysis}`,
          {
            parse_mode: 'Markdown',
            ...getResumoAdditionalButtons(expenses)
          }
        );
      }
    } catch (error) {
      console.error(`Erro ao enviar resumo para chat ${chatId}:`, error);
    }
  }
});

// Agendar envio de resumo diário às 22:00
schedule.scheduleJob('0 22 * * *', async () => {
  // Buscar lista de chats ativos
  const activeChats = process.env.ACTIVE_CHATS ? process.env.ACTIVE_CHATS.split(',') : [];

  for (const chatId of activeChats) {
    try {
      const expenses = getExpensesFromStorage(chatId, 1);

      if (expenses.length > 0) {
        const summary = formatExpensesSummary(expenses);
        await telegram.sendMessage(
          chatId,
          `🌙 Resumo diário de gastos:\n\n${summary}`,
          getResumoAdditionalButtons(expenses)
        );
      }
    } catch (error) {
      console.error(`Erro ao enviar resumo para chat ${chatId}:`, error);
    }
  }
});

// Handler para adicionar mais gastos
bot.action('adicionar', async (ctx) => {
  await ctx.answerCbQuery('Informe o novo gasto...');
  ctx.reply('Informe um novo gasto no formato:\n"Nome do produto Preço"\n\nExemplos:\n- Café 5.50\n- Pizza R$25\n- Uber 15,90',
    getMainKeyboard());
});

// Handler para remover gasto via botão
bot.action(/remove_(\d+)/, async (ctx) => {
  try {
    await ctx.answerCbQuery('Removendo gasto...');

    const expenseId = parseInt(ctx.match[1]);
    const chatId = ctx.chat.id.toString();

    if (!expensesStorage[chatId] || expensesStorage[chatId].length === 0) {
      return ctx.editMessageText('Não há gastos registrados para remover.');
    }

    const index = expensesStorage[chatId].findIndex(expense => expense.id === expenseId);

    if (index === -1) {
      return ctx.editMessageText(`Não foi encontrado nenhum gasto com ID ${expenseId}.`);
    }

    const removedExpense = expensesStorage[chatId].splice(index, 1)[0];
    ctx.editMessageText(`✅ Removido: ${removedExpense.product} - R$ ${removedExpense.price.toFixed(2)}`,
      getMainKeyboard());
  } catch (error) {
    console.error('Erro ao remover gasto:', error);
    ctx.answerCbQuery('Ocorreu um erro. Tente novamente.');
  }
});

// Adicionar handler para categorização de gastos
bot.action('categorizar', async (ctx) => {
  try {
    await ctx.answerCbQuery('Categorizando seus gastos...');

    const chatId = ctx.chat.id.toString();
    const expenses = getExpensesFromStorage(chatId, 30);

    if (expenses.length === 0) {
      return ctx.editMessageText('Não há gastos para categorizar.', getMainKeyboard());
    }

    // Preparar para categorização com IA
    const expensesText = expenses.map(e => e.product).join(', ');

    const prompt = `
Categorize os seguintes itens de despesa em categorias claras e úteis (ex: Alimentação, Transporte, Lazer, etc):
${expensesText}

Responda com uma lista de categorias e seus respectivos itens no formato:
categoria1: item1, item2
categoria2: item3, item4

Use no máximo 5 categorias principais. Seja objetivo e conciso.
`;

    // Mensagem de aguarde
    await ctx.editMessageText('🧠 Categorizando seus gastos... Aguarde um momento.');

    // Obter categorização
    const result = await model.generateContent(prompt);
    const categories = result.response.text();

    let totalByCategory = {};

    // Tentar extrair categorias para cálculo de totais
    try {
      const categoryLines = categories.split('\n');

      for (const line of categoryLines) {
        if (line.includes(':')) {
          const [category, itemsText] = line.split(':');
          const categoryName = category.trim();

          if (!totalByCategory[categoryName]) {
            totalByCategory[categoryName] = 0;
          }

          const items = itemsText.split(',').map(i => i.trim().toLowerCase());

          // Somar valores dos itens dessa categoria
          for (const expense of expenses) {
            const productLower = expense.product.toLowerCase();
            if (items.some(item => productLower.includes(item))) {
              totalByCategory[categoryName] += expense.price;
            }
          }
        }
      }

      // Adicionar totais por categoria
      let categoryMessage = '📊 *Suas despesas por categoria:*\n\n';
      categoryMessage += categories + '\n\n';
      categoryMessage += '*Totais por categoria:*\n';

      for (const [category, total] of Object.entries(totalByCategory)) {
        categoryMessage += `${category}: R$ ${total.toFixed(2)}\n`;
      }

      ctx.editMessageText(categoryMessage, {
        parse_mode: 'Markdown',
        ...getResumoKeyboard()
      });
    } catch (error) {
      console.error('Erro ao processar categorias:', error);
      ctx.editMessageText(`📊 *Categorias de gastos:*\n\n${categories}`, {
        parse_mode: 'Markdown',
        ...getResumoKeyboard()
      });
    }
  } catch (error) {
    console.error('Erro ao categorizar gastos:', error);
    ctx.editMessageText('Não foi possível categorizar seus gastos. Tente novamente mais tarde.',
      getMainKeyboard());
  }
});

// Iniciar o bot
bot.launch().then(() => {
  console.log('Bot iniciado com sucesso!');
}).catch(err => {
  console.error('Erro ao iniciar o bot:', err);
});

// Encerramento gracioso
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));