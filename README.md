# trizum

[![All Contributors](https://img.shields.io/github/all-contributors/HorusGoul/trizum?color=ee8449&style=flat-square)](#contributors)

**Split bills with friends and family.** Track, calculate, and settle expenses together, with a focus on offline-first, collaborative data synchronization.

## ✨ Features

- **Offline-first architecture**. Works without internet, syncs when you're back online
- **Real-time collaboration**. Changes sync across devices instantly via Automerge CRDTs
- **Multi-party expense splitting**. Supports equal splits, custom amounts, and weighted percentages
- **Settlement calculations**. Automatically calculates who owes whom
- **Receipt attachments**. Attach photos of receipts to expenses
- **PWA & Native apps**. Available as a Progressive Web App and native Android/iOS apps
- **Multi-language support**. Internationalized with Lingui (English & Spanish for now)
- **Migration support**. Import your data from other proprietary apps (currently only Tricount is supported).

## 🏗️ Architecture

trizum is built as a **monorepo** with a local-first architecture. The core principle is that all data lives on the client first, with optional synchronization to a server for cross-device access.

### Data Flow

1. **Local Changes**. All user actions immediately update the local Automerge document
2. **Persistence**. Documents are stored in IndexedDB for offline access
3. **Sync**. When online, changes are synchronized via WebSocket to the server
4. **Conflict Resolution**. Automerge CRDTs automatically merge changes from multiple devices

## 📦 Packages

| Package                                                 | Description                                                      |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| [`@trizum/pwa`](./packages/pwa)                         | Main web application. React + Vite PWA with offline support      |
| [`@trizum/mobile`](./packages/mobile)                   | Native mobile apps wrapper using Capacitor (Android & iOS)       |
| [`@trizum/server`](./packages/server)                   | Sync server. Hono + Automerge repo for WebSocket synchronization |
| [`@trizum/screenshots`](./packages/screenshots)         | Automated screenshot generation for app stores using Playwright  |
| [`@trizum/eslint-config`](./packages/eslint-config)     | Shared ESLint configuration                                      |
| [`@trizum/prettier-config`](./packages/prettier-config) | Shared Prettier configuration                                    |
| [`@trizum/tsconfig`](./packages/tsconfig)               | Shared TypeScript configuration                                  |

## 🛠️ Tech Stack

| Category            | Technology                              |
| ------------------- | --------------------------------------- |
| **Runtime**         | Node.js 24                              |
| **Package Manager** | pnpm 10                                 |
| **Monorepo**        | Turborepo + pnpm workspaces             |
| **Frontend**        | React (experimental w/ React Compiler)  |
| **Routing**         | TanStack Router                         |
| **Styling**         | Tailwind CSS                            |
| **State/Sync**      | Automerge (CRDT)                        |
| **i18n**            | Lingui                                  |
| **Build**           | Vite                                    |
| **Testing**         | Vitest                                  |
| **Mobile**          | Capacitor                               |
| **Server**          | Hono + Drizzle ORM                      |
| **Database**        | LibSQL (SQLite)                         |
| **Deployment**      | Cloudflare Pages (PWA), Fly.io (Server) |

## 🚀 Getting Started

### Prerequisites

- Node.js 24+ (use `nvm use` to set the correct version)
- pnpm 10.14.0+

### Installation

```bash
# Clone the repository
git clone https://github.com/HorusGoul/trizum.git
cd trizum

# Use correct Node version
nvm use

# Install dependencies
pnpm install
```

### Development

```bash
# Start the PWA development server
cd packages/pwa
pnpm dev

# Or run commands from root
pnpm build        # Build all packages
pnpm test         # Run all tests
pnpm lint         # Lint all packages
pnpm typecheck    # Type check all packages
```

### Running Mobile Apps

```bash
cd packages/mobile

# Android
pnpm dev:android

# iOS
pnpm dev:ios
```

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](./CONTRIBUTING.md) for details on:

- Development setup and workflow
- Code style guidelines
- Testing requirements
- Pull request process

## 📝 License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Contributors

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->
