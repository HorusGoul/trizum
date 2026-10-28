# TypeScript package template

Starting point for new workspace libraries, with shared TypeScript configuration,
Vite+ tasks, tests, and a package-local logging facade.

For copying and customizing this template, follow [package authoring](../../docs/package-authoring.md).
Replace this README with the new package's purpose, key files, and validation commands.

- [`package.json`](./package.json): package identity and exports.
- [`vite.config.ts`](./vite.config.ts): check, test, build, and dev tasks.
- [`tsconfig.json`](./tsconfig.json): emitted library build.
- [`tsconfig.test.json`](./tsconfig.test.json): test-inclusive type checking.

Run `vp run check`, `vp run test`, or `vp run build` from this directory when
changing the template; `vp run dev` starts the compiler in watch mode.
