# Frenzy

> [!WARNING]
> This project includes automation around Discord account activity. Automating Discord accounts can violate Discord Terms of Service. We do not promote, encourage, or endorse violating Discord ToS.

## Overview
Frenzy is a Bun + TypeScript trading workflow project that:
- Monitors Discord messages.
- Extracts and analyzes chart data.
- Uses AI providers for trade interpretation.
- Tracks market data from Binance.
- Sends updates through a Discord bot.

## Tech Stack
- Bun + TypeScript
- Discord clients (`discord.js`, `discord.js-selfbot-v13`)
- Binance futures API
- OCR service (PaddleOCR endpoint)
- PostgreSQL via MikroORM

## Setup
1. Install dependencies:

```bash
bun install
```

2. Create a `.env` file in the project root with:

```env
DISCORD_TOKEN=
DISCORD_BOT_TOKEN=
GROQ_API_KEY=
OPENROUTER_API_KEY=
MONGODB_URI=
```

## Run
Start the app:

```bash
bun run src/index.ts
```

## Notes
- Ensure your OCR service is reachable at `http://127.0.0.1:8000/parse-chart`.
- Configure database and Discord server/channel IDs in `config.ts` as needed.
