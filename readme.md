🤖 AI-Powered Sales Control Bot

A Telegram bot that allows you to log and analyze sales and profits, with smart features powered by the Google Gemini API.
✨ Features

    Daily sales logging

    Daily sales summary

    Monthly sales total

    AI-powered sales analysis (Google Gemini)

    Insights to improve sales

    Automatic product categorization

    Automatic sending of daily and weekly summaries

🔧 Technologies

    Node.js

    Telegraf – Modern framework for building Telegram bots

    Google Gemini API – Google’s generative AI

    Node Schedule – Task scheduling

🚀 Setup and Usage
Prerequisites

    Node.js v14+

    A Telegram bot (created via @BotFather)

    A Google Gemini API key

Environment Variables

Create a .env file in the root directory of the project with:

BOT_TOKEN=your_telegram_bot_token
GEMINI_API_KEY=your_gemini_api_key
ACTIVE_CHATS=chat_id1,chat_id2

Installation

npm install
npm start

📋 Commands

    /start – Starts the bot and displays help

    /resumo – Shows today's sales summary

    /total – Displays total sales for the month

    /analise – Provides an AI analysis of your sales

    /remove [id] – Removes a specific sale

💡 How to Use

    Start a conversation with the bot by sending /start

    Log a sale by sending messages in the format: Product name price

        Examples: Coffee 5.50 or Pizza 25

        You can also use natural language: Sold coffee for 10 reais

🧠 Artificial Intelligence

The bot uses the Google Gemini API for:

    On-demand analysis: Use the /analise command to get insights on your sales from the past 30 days

    Weekly summaries: Automatically receive a weekly summary with analysis of your sales

    Improvement suggestions: The AI detects sales patterns and suggests ways to increase your profits

📝 Notes

This bot stores data in memory and is intended for educational purposes. For production use, persistent storage (e.g., a database) would be necessary.
📄 License

This project is licensed under the MIT License.
