# GayBot

> by Aria Rees & Clove Nytrix Doughmination Twilight

A Discord bot for LGBTQIA+ servers — keyword emoji reactions, identity profiles, lookups, and a few fun extras.

<div align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Discord.js-5865F2?logo=discord&logoColor=white" alt="Discord.js" />
  <img src="https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=fff" alt="Docker" />
  <img src="https://img.shields.io/badge/ESLint-4B32C3?logo=eslint&logoColor=fff" alt="ESLint" />
  <img src="https://img.shields.io/badge/Prettier-F7B93E?logo=prettier&logoColor=000" alt="Prettier" />
</div>

## Installation (end users)

The easiest way to add the bot to your Discord server is the [official install link](https://discord.com/oauth2/authorize?client_id=1475380726643032064).

## Development

### Prerequisites

- Node.js 20 or newer
- A Discord application + bot token ([Discord Developer Portal](https://discord.com/developers/applications))

### Setup

```bash
git clone https://github.com/Girls-Network/GayBot-v2.git
cd GayBot-v2
npm install
cp .env.example .env   # then fill in DISCORD_TOKEN, etc.
```

### Available scripts

| Script               | What it does                                            |
| -------------------- | ------------------------------------------------------- |
| `npm run dev`        | Run the bot under nodemon — restarts on TS file changes |
| `npm run start`      | Run the bot once via ts-node (no rebuild needed)        |
| `npm run build`      | Compile TypeScript into `dist/`                         |
| `npm run lint`       | ESLint over `src/**/*.ts` and root JS, with `--fix`     |
| `npm run format`     | Prettier write across all source/config/markdown        |
| `npm run prettylint` | Lint then format. **Run this before every PR.**         |
| `npm run test`       | Type-check the codebase via `tsc --noEmit`              |

CI runs `lint`, `prettier --check`, and `test` against every PR — local `prettylint && test` exiting clean is a good signal CI will be green.

### Project layout

```
src/
├─ main.ts             # Entry: client setup, event loading, reaction queue
├─ shard.ts            # Sharding wrapper around main.ts
├─ commands/           # Slash commands (auto-discovered)
├─ events/             # Discord gateway event handlers (auto-discovered)
├─ handlers/           # Command + error registration
├─ utils/              # Logger, banner rotator, identity manager, etc.
├─ pk/  + plural/      # PluralKit and Plural client + cache + resolver
└─ configs/            # Static reaction/emoji JSON
```

## Tech Stack

Discord.js v14, TypeScript, Node 20, Docker (deployment), ESLint v9 + typescript-eslint (linting), Prettier (formatting).

## Contributors

<a href="https://github.com/Girls-Network/GayBot-v2/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Girls-Network/GayBot-v2" alt="Contributors" />
</a>

## Important Documents

- **Licence** — MIT. See [LICENCE](./LICENCE).
- **Security** — Vulnerability reporting in [SECURITY.md](./SECURITY.md).
- **Contributing** — Process and standards in [CONTRIBUTING.md](./CONTRIBUTING.md).
- **Code of Conduct** — Community expectations in [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
- **Privacy Policy** — Data handling in [Privacy.md](./Privacy.md).
- **Terms of Service** — Usage terms in [ToS.md](./ToS.md).

## Credits

This project was originally made by **MeltyMooncakes** — we still credit her as the original author even though we now own and maintain it.

Additional credit to **ThatGirl_Photographer** for parts of the old bot that have carried over into this rewrite.
