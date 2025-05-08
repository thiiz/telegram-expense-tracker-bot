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

// Armazenamento simples para vendas (em memória)
// Em uma aplicação real, você usaria um banco de dados
const salesStorage = {};
const salesIdCounter = {}; // Contador de IDs por chat

// Comando de início
bot.start((ctx) => {
  ctx.reply(
    'Bem-vindo ao Bot de Controle de Vendas! 💰\n\n' +
    'Para registrar uma venda, você pode:\n' +
    '• Usar formato simples: "Café 5.50" ou "Pizza 25"\n' +
    '• Usar linguagem natural: "Vendi 35 em café" ou "Recebi 12,50 pelo bolo"\n' +
    '• Informar quantidade: "Vendi 4 camisetas por 40 reais"\n\n' +
    'Use os botões abaixo ou os comandos:\n' +
    '/start - Exibe esta mensagem de ajuda\n' +
    '/resumo - Exibe o resumo das vendas de hoje\n' +
    '/total - Exibe o total vendido este mês\n' +
    '/analise - Análise das suas vendas recentes usando IA\n' +
    '/remove [id] - Remove uma venda pelo seu ID',
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
    const sales = getSalesFromStorage(chatId, 1);

    if (sales.length === 0) {
      return ctx.editMessageText('Você não registrou nenhuma venda hoje.', getMainKeyboard());
    }

    const summary = formatSalesSummary(sales);
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
    const sales = getSalesFromStorage(chatId, daysToFetch);

    if (sales.length === 0) {
      return ctx.editMessageText('Você não registrou nenhuma venda este mês.', getMainKeyboard());
    }

    const total = sales.reduce((sum, sale) => sum + sale.price, 0);
    ctx.editMessageText(`Total vendido neste mês: R$ ${total.toFixed(2)}`, getMainKeyboard());
  } catch (error) {
    console.error('Erro ao calcular total:', error);
    ctx.answerCbQuery('Ocorreu um erro. Tente novamente.');
  }
});

bot.action('analise', async (ctx) => {
  try {
    // Responde ao callback imediatamente
    await ctx.answerCbQuery();
    await ctx.editMessageText('🧠 Analisando suas vendas... Aguarde um momento.', getMainKeyboard());

    const chatId = ctx.chat.id.toString();
    const sales = getSalesFromStorage(chatId, 30);

    if (sales.length === 0) {
      return ctx.editMessageText('Você não possui vendas registradas para análise.', getMainKeyboard());
    }

    const salesData = sales.map(s => `${s.product}: R$ ${s.price.toFixed(2)}`).join('\n');
    const total = sales.reduce((sum, s) => sum + s.price, 0);

    const prompt = `
Analise os seguintes dados de vendas de um usuário nos últimos 30 dias:

${salesData}

Total: R$ ${total.toFixed(2)}

Forneça:
1. Uma análise concisa dos padrões de vendas
2. Sugestões para possíveis melhoras nas vendas
3. Produtos com maior lucro

Responda em português, de forma amigável e objetiva, em até 500 caracteres.
Não formate sua resposta com markdown ou blocos de código.
`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    ctx.editMessageText(`📊 *Análise de Vendas* 📊\n\n${response}`, {
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
    'Como usar o Bot de Controle de Vendas 💰\n\n' +
    '1️⃣ *Para registrar uma venda*:\n' +
    'Você pode usar um dos seguintes formatos:\n' +
    '• Formato simples: "Café 5.50" ou "Pizza R$25"\n' +
    '• Linguagem natural: "Vendi 15 em café" ou\n' +
    '  "Recebi 45 reais pelo bolo hoje"\n' +
    '• Com quantidade: "Vendi 4 camisetas por 40 reais"\n' +
    '  (Registra 4 itens de 10 reais cada)\n\n' +
    '2️⃣ *Para ver o resumo diário*:\n' +
    'Clique no botão "📊 Resumo Diário" ou use /resumo\n\n' +
    '3️⃣ *Para ver o total mensal*:\n' +
    'Clique no botão "💰 Total Mensal" ou use /total\n\n' +
    '4️⃣ *Para análise de vendas com IA*:\n' +
    'Clique no botão "🧠 Análise IA" ou use /analise\n\n' +
    '5️⃣ *Para remover uma venda*:\n' +
    'Use o comando /remove [id] ou use o botão ❌\n' +
    'após registrar uma venda',
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
    const sales = getSalesFromStorage(chatId, 1);

    if (sales.length === 0) {
      return ctx.reply('Você não registrou nenhuma venda hoje.', getMainKeyboard());
    }

    const summary = formatSalesSummary(sales);
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
    const sales = getSalesFromStorage(chatId, daysToFetch);

    if (sales.length === 0) {
      return ctx.reply('Você não registrou nenhuma venda este mês.', getMainKeyboard());
    }

    const total = sales.reduce((sum, sale) => sum + sale.price, 0);
    ctx.reply(`Total vendido neste mês: R$ ${total.toFixed(2)}`, getMainKeyboard());
  } catch (error) {
    console.error('Erro ao calcular total:', error);
    ctx.reply('Ocorreu um erro ao calcular o total. Tente novamente.', getMainKeyboard());
  }
});

// Comando para análise de vendas com IA
bot.command('analise', async (ctx) => {
  try {
    const chatId = ctx.chat.id.toString();
    const sales = getSalesFromStorage(chatId, 30);

    if (sales.length === 0) {
      return ctx.reply('Você não possui vendas registradas para análise.', getMainKeyboard());
    }

    // Enviando mensagem de aguarde
    const waitingMessage = await ctx.reply('🧠 Analisando suas vendas... Aguarde um momento.', getMainKeyboard());

    // Prepara os dados para o modelo
    const salesData = sales.map(s => `${s.product}: R$ ${s.price.toFixed(2)}`).join('\n');
    const total = sales.reduce((sum, s) => sum + s.price, 0);

    // Constrói o prompt para o Gemini
    const prompt = `
Analise os seguintes dados de vendas de um usuário nos últimos 30 dias:

${salesData}

Total: R$ ${total.toFixed(2)}

Forneça:
1. Uma análise concisa dos padrões de vendas
2. Sugestões para possíveis melhoras nas vendas
3. Produtos com maior lucro

Responda em português, de forma amigável e objetiva, em até 500 caracteres.
Não formate sua resposta com markdown ou blocos de código.
`;

    // Usando Gemini para obter análise
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Remove a mensagem de aguarde
    await ctx.telegram.deleteMessage(chatId, waitingMessage.message_id).catch(e => console.error('Erro ao deletar mensagem:', e));

    // Envia a análise
    await ctx.reply(`📊 *Análise de Vendas* 📊\n\n${response}`, {
      parse_mode: 'Markdown',
      ...getMainKeyboard()
    });
  } catch (error) {
    console.error('Erro ao gerar análise com IA:', error);
    ctx.reply('Não foi possível gerar a análise neste momento. Tente novamente mais tarde.', getMainKeyboard());
  }
});

// Adicionar handlers para confirmação de despesa
bot.action(/confirm_([^_]+)_(\d+(?:\.\d+)?)(?:_(\d+))?/, async (ctx) => {
  try {
    await ctx.answerCbQuery('Registrando venda...');

    // Decodifica o produto de base64
    const encodedProduct = ctx.match[1];
    const product = Buffer.from(encodedProduct, 'base64').toString();

    // Extrai o preço total e a quantidade do callback_data
    const totalPrice = parseFloat(ctx.match[2]);
    const quantity = ctx.match[3] ? parseInt(ctx.match[3]) : 1;

    // Debug para verificar os valores extraídos
    console.log(`Callback data: ${ctx.callbackQuery.data}`);
    console.log(`Match groups: ${JSON.stringify(ctx.match)}`);
    console.log(`Confirmação: produto=${product}, preço total=${totalPrice}, quantidade=${quantity}`);

    // Validação adicional
    if (isNaN(totalPrice) || totalPrice <= 0) {
      console.error(`Erro: Preço total inválido: ${totalPrice}`);
      return ctx.reply('Erro: O preço total é inválido. Por favor, tente novamente.');
    }

    if (isNaN(quantity) || quantity <= 0) {
      console.error(`Erro: Quantidade inválida: ${quantity}`);
      return ctx.reply('Erro: A quantidade é inválida. Por favor, tente novamente.');
    }

    if (quantity === 1) {
      // Caso de venda única
      await processSale(ctx, product, totalPrice);
    } else {
      // Caso de múltiplas vendas - importante: dividir o preço total pela quantidade
      const individualPrice = totalPrice / quantity;
      console.log(`Preço individual calculado: ${individualPrice}`);

      const registeredIds = [];
      const promises = [];

      // Registra cada item individualmente com o preço correto
      for (let i = 0; i < quantity; i++) {
        // Usamos Promise.all para garantir que todos os itens sejam processados
        promises.push(
          processSale(ctx, product, individualPrice, false)
            .then(saleId => {
              if (saleId) {
                registeredIds.push(saleId);
                console.log(`Item ${i + 1}/${quantity} registrado com ID ${saleId}`);
              } else {
                console.error(`Falha ao registrar item ${i + 1}/${quantity}`);
              }
            })
            .catch(err => {
              console.error(`Erro ao registrar item ${i + 1}/${quantity}:`, err);
            })
        );
      }

      // Aguarda todas as vendas serem registradas
      await Promise.all(promises);
      console.log(`Todos os ${quantity} itens registrados. IDs: ${registeredIds.join(', ')}`);

      if (registeredIds.length === 0) {
        return ctx.reply('Erro: Não foi possível registrar as vendas. Por favor, tente novamente.');
      }

      // Envia mensagem de confirmação após registrar todos os itens
      const chatId = ctx.chat.id.toString();
      const idsText = registeredIds.length > 0 ? `IDs: #${registeredIds.join(', #')}` : '';

      ctx.reply(
        `✅ Registrado: ${quantity}x ${product} - Total: R$ ${totalPrice.toFixed(2)} (R$ ${individualPrice.toFixed(2)} cada)` +
        (idsText ? `\n${idsText}` : ''),
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📊 Ver Resumo', callback_data: 'resumo' },
                { text: '➕ Adicionar Mais', callback_data: 'adicionar' }
              ]
            ]
          }
        }
      );
    }

    // Remover a mensagem de confirmação
    await ctx.deleteMessage();
  } catch (error) {
    console.error('Erro ao confirmar venda:', error);
    ctx.reply('Ocorreu um erro ao processar a venda. Por favor, tente novamente.');
  }
});

bot.action('cancel_sale', async (ctx) => {
  await ctx.answerCbQuery('Operação cancelada');
  await ctx.editMessageText('Operação cancelada. Tente novamente com um formato como:\n"Café 5.50" ou "Pizza R$25"', getMainKeyboard());
});

// Função para processar venda
async function processSale(ctx, product, price, sendMessage = true) {
  try {
    // Verifica se o preço é válido
    if (isNaN(price) || price <= 0) {
      console.error("Preço inválido:", price);
      if (sendMessage) {
        ctx.reply('Erro: Preço inválido. Por favor, tente novamente com um valor válido.');
      }
      return null;
    }

    // Formata o valor para garantir que seja um número
    const numericPrice = Number(price);
    console.log(`Processando venda: ${product} - R$ ${numericPrice.toFixed(2)}`);

    // Para vendas em lote, reduz o uso de IA para formatação para melhorar performance
    let formattedProduct = product;

    // Apenas usa IA para formatação no primeiro item (quando sendMessage é true)
    // ou em vendas únicas para reduzir overhead
    if (sendMessage) {
      try {
        const prompt = `
        Formate o nome deste item de venda para ser consistente e organizado: "${product}".
        Use apenas letras minúsculas, corrija erros ortográficos óbvios, e padronize o nome.
        Não adicione informações extras, apenas retorne o nome formatado.
        Exemplos: "cafe" → "café", "refri coca" → "refrigerante coca-cola", "almoço restaurante" → "almoço".
        Responda apenas com o texto formatado, sem explicações.
        `;

        // Usando Gemini para formatar o texto
        const result = await model.generateContent(prompt);
        const aiFormattedProduct = result.response.text().trim();

        // Se o AI retornou algo vazio ou muito diferente, mantém o original
        if (aiFormattedProduct && aiFormattedProduct.length <= product.length * 2) {
          formattedProduct = aiFormattedProduct;
          console.log("Produto formatado pela IA:", formattedProduct);
        }
      } catch (formatError) {
        console.error("Erro ao formatar produto com IA:", formatError);
        // Continua com o produto original em caso de erro
      }
    }

    // Salva a venda no armazenamento
    const chatId = ctx.chat.id.toString();
    const sale = {
      product: formattedProduct,
      price: numericPrice,  // Garante que é um número
      date: new Date()
    };

    const saleId = saveSale(chatId, sale);
    console.log(`Venda salva: ID=${saleId}, Produto=${formattedProduct}, Preço=${numericPrice}`);

    // Envia mensagem de confirmação apenas se solicitado
    if (sendMessage) {
      ctx.reply(`✅ Registrado: #${saleId} - ${formattedProduct} - R$ ${numericPrice.toFixed(2)}\n\nPara remover, use /remove ${saleId}`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📊 Ver Resumo', callback_data: 'resumo' },
              { text: '➕ Adicionar Mais', callback_data: 'adicionar' }
            ],
            [
              { text: '❌ Remover', callback_data: `remove_${saleId}` }
            ]
          ]
        }
      });
    }

    // Retorna o ID da venda para uso em outras funções
    return saleId;
  } catch (error) {
    console.error('Erro ao processar venda:', error);
    if (sendMessage) {
      ctx.reply('Ocorreu um erro ao processar sua mensagem. Tente novamente.');
    }
    return null;
  }
}

// Função para salvar uma venda no armazenamento
function saveSale(chatId, sale) {
  if (!salesStorage[chatId]) {
    salesStorage[chatId] = [];
    salesIdCounter[chatId] = 0;
  }

  // Incrementa o contador e adiciona ID único para este chat
  salesIdCounter[chatId]++;
  sale.id = salesIdCounter[chatId];

  salesStorage[chatId].push(sale);
  console.log(`Venda salva para o chat ${chatId}:`, sale);

  return sale.id;
}

// Função para buscar vendas do armazenamento
function getSalesFromStorage(chatId, daysBack = 1) {
  const sales = salesStorage[chatId] || [];
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - daysBack + 1); // +1 para incluir o dia atual
  startDate.setHours(0, 0, 0, 0);

  // Filtra as vendas pela data
  return sales.filter(sale => {
    const saleDate = new Date(sale.date);
    return saleDate >= startDate;
  });
}

// Função para formatar o resumo de vendas
function formatSalesSummary(salesList) {
  let summary = '📊 Resumo de Vendas:\n\n';

  salesList.forEach((sale) => {
    summary += `#${sale.id} - ${sale.product}: R$ ${sale.price.toFixed(2)}\n`;
  });

  const total = salesList.reduce((sum, sale) => sum + sale.price, 0);
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
          { text: '➕ Adicionar Venda', callback_data: 'adicionar' },
          { text: '⬅️ Voltar', callback_data: 'ajuda' }
        ]
      ]
    }
  };
}

// Atualizar os teclados para mensagens de resumo semanal/diário
function getResumoAdditionalButtons(expenses) {
  const buttons = [];

  // Se há muitas vendas, oferece categorização
  if (expenses.length >= 5) {
    buttons.push([{ text: '📊 Categorizar Vendas', callback_data: 'categorizar' }]);
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
      const sales = getSalesFromStorage(chatId, 7); // Pega os dados da semana

      if (sales.length > 0) {
        // Prepara os dados para o modelo
        const salesData = sales.map(s => `${s.product}: R$ ${s.price.toFixed(2)}`).join('\n');
        const total = sales.reduce((sum, s) => sum + s.price, 0);

        // Constrói o prompt para o Gemini
        const prompt = `
Analise os seguintes dados de vendas de um usuário na última semana:

${salesData}

Total: R$ ${total.toFixed(2)}

Forneça:
1. Um breve resumo das vendas da semana
2. Uma dica para aumentar as vendas baseada nos padrões observados
3. Uma previsão para a próxima semana

Responda em português, de forma amigável e concisa, em até 300 caracteres.
`;

        // Obtém análise do Gemini
        const result = await model.generateContent(prompt);
        const aiAnalysis = result.response.text();

        const summary = formatSalesSummary(sales);
        await telegram.sendMessage(
          chatId,
          `🌙 Resumo semanal de vendas:\n\n${summary}\n\n💡 *Insights da IA*:\n${aiAnalysis}`,
          {
            parse_mode: 'Markdown',
            ...getResumoAdditionalButtons(sales)
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
      const sales = getSalesFromStorage(chatId, 1);

      if (sales.length > 0) {
        const summary = formatSalesSummary(sales);
        await telegram.sendMessage(
          chatId,
          `🌙 Resumo diário de vendas:\n\n${summary}`,
          getResumoAdditionalButtons(sales)
        );
      }
    } catch (error) {
      console.error(`Erro ao enviar resumo para chat ${chatId}:`, error);
    }
  }
});

// Handler para adicionar mais vendas
bot.action('adicionar', async (ctx) => {
  await ctx.answerCbQuery('Informe a nova venda...');
  ctx.reply('Informe uma nova venda no formato:\n"Nome do produto Preço"\n\nExemplos:\n- Café 5.50\n- Pizza R$25\n- Uber 15,90',
    getMainKeyboard());
});

// Handler para remover venda via botão
bot.action(/remove_(\d+)/, async (ctx) => {
  try {
    await ctx.answerCbQuery('Removendo venda...');

    const saleId = parseInt(ctx.match[1]);
    const chatId = ctx.chat.id.toString();

    if (!salesStorage[chatId] || salesStorage[chatId].length === 0) {
      return ctx.editMessageText('Não há vendas registradas para remover.');
    }

    const index = salesStorage[chatId].findIndex(sale => sale.id === saleId);

    if (index === -1) {
      return ctx.editMessageText(`Não foi encontrada nenhuma venda com ID ${saleId}.`);
    }

    const removedSale = salesStorage[chatId].splice(index, 1)[0];
    ctx.editMessageText(`✅ Removido: ${removedSale.product} - R$ ${removedSale.price.toFixed(2)}`,
      getMainKeyboard());
  } catch (error) {
    console.error('Erro ao remover venda:', error);
    ctx.answerCbQuery('Ocorreu um erro. Tente novamente.');
  }
});

// Adicionar handler para categorização de vendas
bot.action('categorizar', async (ctx) => {
  try {
    await ctx.answerCbQuery('Categorizando suas vendas...');

    const chatId = ctx.chat.id.toString();
    const sales = getSalesFromStorage(chatId, 30);

    if (sales.length === 0) {
      return ctx.editMessageText('Não há vendas para categorizar.', getMainKeyboard());
    }

    // Preparar para categorização com IA
    const salesText = sales.map(s => s.product).join(', ');

    const prompt = `
Categorize os seguintes produtos vendidos em categorias claras e úteis (ex: Alimentação, Vestimenta, Eletrônicos, etc):
${salesText}

Responda com uma lista de categorias e seus respectivos produtos no formato:
categoria1: produto1, produto2
categoria2: produto3, produto4

Use no máximo 5 categorias principais. Seja objetivo e conciso.
`;

    // Mensagem de aguarde
    await ctx.editMessageText('🧠 Categorizando suas vendas... Aguarde um momento.');

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
          for (const sale of sales) {
            const productLower = sale.product.toLowerCase();
            if (items.some(item => productLower.includes(item))) {
              totalByCategory[categoryName] += sale.price;
            }
          }
        }
      }

      // Adicionar totais por categoria
      let categoryMessage = '📊 *Suas vendas por categoria:*\n\n';
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
      ctx.editMessageText(`📊 *Categorias de vendas:*\n\n${categories}`, {
        parse_mode: 'Markdown',
        ...getResumoKeyboard()
      });
    }
  } catch (error) {
    console.error('Erro ao categorizar vendas:', error);
    ctx.editMessageText('Não foi possível categorizar suas vendas. Tente novamente mais tarde.',
      getMainKeyboard());
  }
});

// Comando para remover uma venda
bot.command('remove', async (ctx) => {
  try {
    const text = ctx.message.text;
    const params = text.split(' ');

    if (params.length !== 2) {
      return ctx.reply('Uso correto: /remove [id]');
    }

    const saleId = parseInt(params[1]);
    if (isNaN(saleId)) {
      return ctx.reply('ID inválido. Use /remove seguido do número ID da venda.');
    }

    const chatId = ctx.chat.id.toString();

    if (!salesStorage[chatId] || salesStorage[chatId].length === 0) {
      return ctx.reply('Não há vendas registradas para remover.');
    }

    const index = salesStorage[chatId].findIndex(sale => sale.id === saleId);

    if (index === -1) {
      return ctx.reply(`Não foi encontrada nenhuma venda com ID ${saleId}.`);
    }

    const removedSale = salesStorage[chatId].splice(index, 1)[0];
    ctx.reply(`✅ Removido: ${removedSale.product} - R$ ${removedSale.price.toFixed(2)}`);

  } catch (error) {
    console.error('Erro ao remover venda:', error);
    ctx.reply('Ocorreu um erro ao tentar remover a venda. Tente novamente.');
  }
});

// Add a message handler for processing sales via text
bot.on('message', async (ctx) => {
  // Only process text messages
  if (!ctx.message.text) return;

  // Skip if it's a command (starts with /)
  if (ctx.message.text.startsWith('/')) return;

  const text = ctx.message.text.trim();
  console.log(`Nova mensagem recebida: "${text}"`);

  try {
    // Sending waiting message
    const waitingMsg = await ctx.reply('🧠 Interpretando sua mensagem... Aguarde um momento.');

    // Constrói o prompt para o Gemini
    const prompt = `
Analise a seguinte mensagem de venda em português e extraia o produto/serviço vendido, o valor e a quantidade:
"${text}"

Exemplos de entradas e suas interpretações:
1. "Vendi café hoje por 5 reais" → produto: café, valor: 5, quantidade: 1
2. "Recebi 150,90 pela venda do bolo" → produto: bolo, valor: 150.90, quantidade: 1
3. "Cliente comprou almoço por 32 reais" → produto: almoço, valor: 32, quantidade: 1
4. "Camiseta 25" → produto: camiseta, valor: 25, quantidade: 1
5. "Vendi produtos do mercado, recebi 175,50" → produto: produtos mercado, valor: 175.50, quantidade: 1
6. "Vendi 4 camisetas por 40 reais" → produto: camiseta, valor: 40, quantidade: 4
7. "Entreguei 3 bolos por 75 reais no total" → produto: bolo, valor: 75, quantidade: 3
8. "Vendi 5 cafés hoje a 25 reais" → produto: café, valor: 25, quantidade: 5

Responda APENAS com um JSON no formato:
{
  "produto": "nome do produto ou serviço",
  "valor": número (com ponto como separador decimal),
  "quantidade": número inteiro
}

Se não for possível extrair o produto e valor, responda com:
{
  "erro": "Não foi possível identificar o produto e valor"
}

IMPORTANTE: Não inclua formatação markdown, blocos de código ou outras marcações. Responda apenas com o objeto JSON puro.
`;

    // Usando Gemini para interpretar a entrada
    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text().trim();
    console.log("Resposta da IA:", aiResponse);

    try {
      // Remover possíveis marcações markdown da resposta
      let cleanResponse = aiResponse;
      if (cleanResponse.includes('```')) {
        // Remove blocos de código, pegando apenas o conteúdo dentro do bloco
        cleanResponse = cleanResponse.replace(/```(?:json)?([^`]*)```/gs, '$1').trim();
      }

      // Tenta analisar a resposta como JSON
      const parsedResponse = JSON.parse(cleanResponse);
      console.log("JSON interpretado:", parsedResponse);

      // Remove mensagem de aguarde
      await ctx.telegram.deleteMessage(ctx.chat.id, waitingMsg.message_id).catch(e => { });

      if (parsedResponse.erro) {
        // IA não conseguiu interpretar
        ctx.reply(
          'Não consegui entender sua mensagem. Por favor, use um formato como:\n' +
          '"Café 5.50" ou "Pizza R$25" ou "Camiseta R$15,90"',
          getMainKeyboard()
        );
      } else {
        // Extraiu produto, valor e quantidade com sucesso
        const product = parsedResponse.produto;
        const price = parseFloat(parsedResponse.valor);
        const quantity = parseInt(parsedResponse.quantidade) || 1;

        // Validação extra dos valores
        if (isNaN(price) || price <= 0) {
          return ctx.reply('Não consegui entender o valor da venda. Por favor, tente novamente com um valor válido.');
        }

        if (isNaN(quantity) || quantity <= 0) {
          return ctx.reply('Não consegui entender a quantidade. Por favor, tente novamente.');
        }

        // Calcula o preço individual se a quantidade for maior que 1
        const singlePrice = quantity > 1 ? price / quantity : price;
        console.log(`Venda interpretada: ${quantity}x ${product} a R$ ${singlePrice.toFixed(2)} cada (total: R$ ${price.toFixed(2)})`);

        // Codifica o produto em base64 para evitar problemas com caracteres especiais no callback_data
        const encodedProduct = Buffer.from(product).toString('base64');

        // Prepara mensagem de confirmação
        let confirmMessage = '';
        if (quantity > 1) {
          confirmMessage = `Entendi que você vendeu ${quantity} unidades de "${product}" por R$ ${price.toFixed(2)} no total (R$ ${singlePrice.toFixed(2)} cada). Está correto?`;
        } else {
          confirmMessage = `Entendi que você vendeu "${product}" por R$ ${price.toFixed(2)}. Está correto?`;
        }

        // Garantir que price seja passado como string com casas decimais (para evitar problemas com números inteiros)
        const priceStr = price.toFixed(2).replace(/\.00$/, ''); // Remove .00 se for um valor inteiro

        // Cria o callback_data garantindo que os valores sejam strings para evitar problemas
        const callbackData = `confirm_${encodedProduct}_${priceStr}_${quantity.toString()}`;
        console.log(`Criando callback_data: ${callbackData}`);

        // Confirma com o usuário
        ctx.reply(
          confirmMessage,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ Sim, registrar', callback_data: callbackData },
                  { text: '❌ Não, cancelar', callback_data: 'cancel_sale' }
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
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
    ctx.reply('Ocorreu um erro ao processar sua mensagem. Tente novamente.');
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