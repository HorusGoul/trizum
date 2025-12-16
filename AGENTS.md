# trizum - AI Agent Guide

## Project Overview

**trizum** helps you split bills with friends and family. Track, calculate, and settle expenses together - similar to apps like SplitWise or Tricount.

**Primary Users:** Friends splitting bills, groups sharing expenses, roommates tracking shared costs.

**Key Features:**

- **Offline-first architecture** powered by Automerge for local-first, collaborative expense tracking
- Real-time synchronization across devices
- Multi-party expense splitting and settlement calculations
- Media attachments for receipts
- Progressive Web App (PWA) with offline capabilities

## Technology Stack

- **Runtime:** Node.js ^20 (use `nvm` for version management)
- **Package Manager:** pnpm 10.14.0
- **Framework:** React (experimental version with React Compiler)
- **Routing:** TanStack Router
- **Styling:** Tailwind CSS
- **State Management:** Automerge for distributed/persisted state
- **Internationalization:** Lingui
- **Build Tool:** Vite
- **Testing:** Vitest
- **Language:** TypeScript (required for all code)

## Development Setup

### Prerequisites

```bash
# Use correct Node version
nvm use

# Install dependencies
pnpm install
```

### Development Commands

**From monorepo root:**

```bash
pnpm build              # Build all packages
pnpm test               # Run all tests
pnpm test:coverage      # Run tests with coverage
pnpm lint               # Lint all packages
pnpm lint:fix           # Auto-fix linting issues
pnpm typecheck          # Type check all packages
pnpm lingui:extract     # Extract i18n strings
```

**From `packages/pwa` directory:**

```bash
pnpm dev                # Start development server
pnpm build              # Build for production
pnpm preview            # Preview production build
pnpm test               # Run tests
pnpm lint               # Lint code
pnpm lint:fix           # Auto-fix linting issues
pnpm typecheck          # Type check
```

### Environment Setup

No special environment variables required for local development. The app works offline-first by default.

## Project Structure

```
packages/pwa/
├── src/
│   ├── ui/                    # Design system components
│   ├── components/            # General application components
│   ├── routes/                # Route components (TanStack Router)
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utility functions and helpers
│   ├── models/                # Automerge document models and types
│   └── main.tsx               # Application entry point
├── public/                    # Static assets
└── functions/                 # Cloudflare Functions (API)
```

**Co-location is encouraged** - keep related files close to where they're used.

## Code Style Guidelines

### React Patterns

**✅ DO:**

- Use React Suspense for async operations
- Leverage React Transitions for UI updates
- Follow the [Rules of React](https://react.dev/reference/rules)
- Prefer React-first libraries over vanilla JS alternatives
- Write all code in TypeScript

**❌ AVOID:**

- `useMemo`, `memo`, and `useCallback` (React Compiler handles optimization)
- Non-React libraries when React alternatives exist

### Component Organization

- **Design system components** → `src/ui/`
- **Application components** → `src/components/`
- **Route components** → `src/routes/`
- Co-locate related files when appropriate

### Styling Conventions

**Color System:**

- Use `accent` color variants for all UI elements
  - `bg-accent-950` → Darkest background
  - `bg-accent-50` → Lightest background
  - Range: 50, 100, 200, ..., 900, 950
- Use semantic variants for statuses:
  - `danger` → Error states
  - `success` → Success states
  - `warning` → Warning states

**Dark Mode:**

- Must be explicitly defined with `dark:` prefix
- Example: `bg-accent-50 dark:bg-accent-950`

**Example:**

```tsx
<div className="bg-accent-50 dark:bg-accent-950 text-accent-900 dark:text-accent-100">
  Content
</div>
```

### Internationalization

**✅ REQUIRED:** All user-facing strings must use Lingui.

```tsx
import { Trans } from "@lingui/macro";
import { t } from "@lingui/macro";

// For JSX content
<Trans>Hello, world!</Trans>;

// For string values
const placeholder = t`Enter your name`;
```

After adding new strings, run:

```bash
pnpm lingui:extract
```

### State Management

**Automerge Documents:**

- Use for data that should be:
  - Persisted across sessions
  - Shared/synced across the network
  - Collaboratively edited

**Local State:**

- Use standard React state (`useState`) for:
  - UI-only state (modals, dropdowns, etc.)
  - Temporary form state
  - Ephemeral interactions

**Example:**

```tsx
// Persisted/shared state
const { party } = useParty(partyId); // Automerge document

// Local UI state
const [isModalOpen, setIsModalOpen] = useState(false);
```

## Testing

**Philosophy:** Prefer unit testing and integration testing.

**Current Focus:**

- Expense calculations must be tested
- Critical business logic should have tests
- No strict coverage target currently

**Running Tests:**

```bash
pnpm test              # Run tests
pnpm test:coverage     # With coverage report
```

**Testing Framework:** Vitest

## Architecture Patterns

### Offline-First with Automerge

trizum uses Automerge for local-first data synchronization. All collaborative data (parties, expenses, participants) is stored in Automerge documents that automatically sync when online.

**Key Concepts:**

- Changes work offline immediately
- Automatic conflict resolution
- Real-time collaboration when connected
- No backend API calls for CRUD operations

### Suspense & Async Patterns

The app uses React Suspense extensively:

- Data fetching suspends during loading
- Use `<Suspense>` boundaries with fallbacks
- Leverage transitions for smoother UX

## Security Considerations

- No sensitive credentials in code
- Client-side only architecture (no backend auth currently)
- Be mindful of data stored in IndexedDB (accessible to user)

## Pull Request Guidelines

- Ensure all tests pass: `pnpm test`
- Verify no linting errors: `pnpm lint`
- Verify types are correct: `pnpm typecheck`
- Extract i18n strings if added: `pnpm lingui:extract`
- Follow existing code conventions
- Keep commits atomic and well-described

## Common Tasks

### Adding a New Feature

1. Identify if it needs Automerge (persistent/shared) or local state
2. Create components in appropriate directory (`ui/` or `components/`)
3. Add i18n strings with Lingui macros
4. Use `accent` color variants for styling
5. Add tests for business logic
6. Run `pnpm lint:fix` and `pnpm typecheck`

### Working with Expenses

- Expense calculations are critical - always add tests
- Use existing models in `src/models/expense.ts`
- Follow patterns in `src/lib/expenses.ts`

### Adding Routes

- Routes are file-based in `src/routes/`
- Use TanStack Router conventions
- Route files are auto-generated in `routeTree.gen.ts` (don't edit manually)

### Working with Media

- Leverage image compression utilities in `src/lib/imageCompression.ts`
- Media files are stored with Automerge

## Monorepo Structure

This is a monorepo managed by:

- **Turbo** - Build system and task runner
- **pnpm workspaces** - Package management
- **Syncpack** - Keep dependencies in sync

The main application is in `packages/pwa/`.

## Additional Notes

- Using experimental React version with React Compiler enabled
- PWA features configured via Vite PWA plugin
- Service worker handles offline caching
- Cloudflare Pages/Functions used for deployment

---

**Questions or Issues?** Check the README or package.json scripts for available commands.
