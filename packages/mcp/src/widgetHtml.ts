/** Embed only build-owned assets so the sandbox needs no external resource access. */
export function createWidgetHtml(assets: { script: string; styles: string; sprite: string }) {
  return `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>trizum</title><style>${assets.styles.replaceAll("</style", "<\\/style")}</style></head><body>${assets.sprite}<div id="root"></div><script>${assets.script.replaceAll("</script", "<\\/script")}</script></body></html>`;
}
