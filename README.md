# Broadsheet & Rapier

A 17th-century swashbuckler fantasy point-and-click web simulation, built on the **Thornwall** engine.

Set in the city of Valdeombra — cynical street-level intrigue, noble rivalries, and low, subtle magic, in the spirit of *Garrett P.I.*, *Fafhrd and the Gray Mouser*, and *Notre-Dame de Paris*.

## Tech Stack

React (TypeScript, strict) · Vite · Tailwind CSS v4 · Zustand · Zod · Framer Motion · Vitest

## Running the Game

Requires Node 24 (see [.nvmrc](.nvmrc) — run `nvm use` if you use nvm).

```bash
npm start
```

Installs dependencies, starts the dev server, and opens the game in your browser.

## Development

```bash
npm install
npm run dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for commit conventions, branching, and the Definition of Done.

## Project Docs

- [docs/game-design-spec.md](docs/game-design-spec.md) — what the game *is*, engine-agnostic
- [docs/web-implementation.md](docs/web-implementation.md) — how it's built in this stack (React/TS/Zustand/Zod)
- [docs/world-lore.md](docs/world-lore.md) — setting, era constraints, tone
- [docs/narrative-inspirations.md](docs/narrative-inspirations.md) — narrative/UI inspiration priority hierarchy
- [docs/execution-plan.md](docs/execution-plan.md) — phased build plan and current status
- [docs/decisions.md](docs/decisions.md) — decision log (why calls were made, not just what changed)
- [CHANGELOG.md](CHANGELOG.md) — notable changes
- [CLAUDE.md](CLAUDE.md) — operating directives for AI-assisted development

## License

All rights reserved. See [LICENSE](LICENSE).