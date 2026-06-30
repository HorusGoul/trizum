/** @type {import("syncpack").RcFile} */
const config = {
  indent: "  ",
  semverGroups: [
    {
      label: "use exact version numbers for dev and prod dependencies",
      packages: ["**"],
      dependencyTypes: ["prod", "dev"],
      dependencies: ["**"],
      range: "",
      specifierTypes: ["!alias"],
    },
  ],
  sortAz: [
    "keywords",
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "contributors",
    "resolutions",
  ],
  sortFirst: [
    "name",
    "version",
    "private",
    "description",
    "keywords",
    "license",
    "author",
    "repository",
    "homepage",
    "bugs",
    "funding",
    "bin",
    "files",
    "type",
    "sideEffects",
    "imports",
    "exports",
    "scripts",
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "engines",
    "packageManager",
    "pnpm",
  ],
  versionGroups: [
    {
      dependencies: ["@types/**"],
      dependencyTypes: ["!dev", "!overrides", "!pnpmCatalog", "!pnpmOverrides"],
      isBanned: true,
      label: "@types packages should only be under devDependencies",
    },
    {
      label: "Use workspace protocol when developing local packages",
      dependencies: ["$LOCAL"],
      dependencyTypes: ["dev", "prod"],
      pinVersion: "workspace:*",
    },
    {
      dependencies: ["@types/react", "@types/react-dom", "react", "react-dom"],
      dependencyTypes: ["pnpmOverrides"],
      isIgnored: true,
      label: "Allow React overrides to diverge from catalog entries",
    },
  ],
  customTypes: {
    nodeEngine: {
      path: "engines.node",
      strategy: "version",
    },
  },
};

module.exports = config;
