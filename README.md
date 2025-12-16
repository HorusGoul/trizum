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

## 📝 License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Contributors

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://horus.dev/"><img src="https://avatars.githubusercontent.com/u/6759612?v=4?s=100" width="100px;" alt="Horus Lugo"/><br /><sub><b>Horus Lugo</b></sub></a><br /><a href="#infra-HorusGoul" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#maintenance-HorusGoul" title="Maintenance">🚧</a> <a href="https://github.com/HorusGoul/trizum/commits?author=HorusGoul" title="Code">💻</a> <a href="https://github.com/HorusGoul/trizum/commits?author=HorusGoul" title="Documentation">📖</a> <a href="#design-HorusGoul" title="Design">🎨</a> <a href="#security-HorusGoul" title="Security">🛡️</a> <a href="#tool-HorusGoul" title="Tools">🔧</a> <a href="https://github.com/HorusGoul/trizum/commits?author=HorusGoul" title="Tests">⚠️</a> <a href="#platform-HorusGoul" title="Packaging/porting to new platform">📦</a> <a href="https://github.com/HorusGoul/trizum/issues?q=author%3AHorusGoul" title="Bug reports">🐛</a> <a href="#ideas-HorusGoul" title="Ideas, Planning, & Feedback">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://mario.nachbaur.dev/contact/"><img src="https://avatars.githubusercontent.com/u/598416?v=4?s=100" width="100px;" alt="Mario Nachbaur"/><br /><sub><b>Mario Nachbaur</b></sub></a><br /><a href="#ideas-marionauta" title="Ideas, Planning, & Feedback">🤔</a> <a href="https://github.com/HorusGoul/trizum/commits?author=marionauta" title="Code">💻</a> <a href="#design-marionauta" title="Design">🎨</a> <a href="https://github.com/HorusGoul/trizum/commits?author=marionauta" title="Tests">⚠️</a> <a href="https://github.com/HorusGoul/trizum/pulls?q=is%3Apr+reviewed-by%3Amarionauta" title="Reviewed Pull Requests">👀</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->
