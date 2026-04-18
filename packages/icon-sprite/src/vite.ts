import path from "node:path";
import type { Plugin } from "vite";
import {
  generateIconSpriteArtifacts,
  getIconSpriteSourceDirectories,
  getIconSpriteUsageRoots,
  type IconSpriteConfig,
  shouldRegenerateIconSprite,
} from "./index.js";

export function createIconSpritePlugin(config: IconSpriteConfig): Plugin {
  let root = "";

  const regenerate = () => {
    if (!root) {
      return { changed: false };
    }

    return generateIconSpriteArtifacts({ config, rootDir: root });
  };

  return {
    name: "vite-plugin-icon-sprite",

    configResolved(resolvedConfig) {
      root = resolvedConfig.root;
    },

    buildStart() {
      regenerate();
    },

    configureServer(server) {
      if (!root) {
        return;
      }

      server.watcher.add([
        ...getIconSpriteUsageRoots(config, root),
        ...getIconSpriteSourceDirectories(config, root),
      ]);

      regenerate();
    },

    handleHotUpdate({ file, server }) {
      if (!root) {
        return;
      }

      if (!shouldRegenerateIconSprite(config, root, path.resolve(file))) {
        return;
      }

      const { changed } = regenerate();

      if (changed) {
        server.ws.send({ type: "full-reload" });
      }
    },
  };
}
