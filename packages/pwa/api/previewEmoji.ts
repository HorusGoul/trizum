import EMOJI_REGEX from "emojibase-regex/emoji";

/** Embed artwork before workers-og renders, since its emoji loader has no fallback. */
export async function embedPreviewEmoji(
  html: string,
  fetchAsset: (url: string) => Promise<Response> = fetch,
) {
  const emojis = [...new Set(html.match(new RegExp(EMOJI_REGEX.source, "g")) ?? [])];

  const artwork = new Map(
    await Promise.all(
      emojis.map(async (emoji) => {
        const code = Array.from(emoji.includes("\u200d") ? emoji : emoji.replace(/\ufe0f/gu, ""))
          .map((character) => character.codePointAt(0)!.toString(16))
          .join("-");

        const fluentUrl = `https://cdn.jsdelivr.net/gh/shuding/fluentui-emoji-unicode/assets/${code}_color.svg`;
        let response = await fetchAsset(fluentUrl);

        if (!response.ok) {
          response = await fetchAsset(
            `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${code}.svg`,
          );
        }

        if (!response.ok) {
          throw new Error(`Could not load preview emoji artwork: ${response.status}`);
        }

        const dataUrl = `data:image/svg+xml;base64,${btoa(await response.text())}`;

        return [emoji, dataUrl] as const;
      }),
    ),
  );

  return html.replace(new RegExp(EMOJI_REGEX.source, "g"), (emoji) => {
    return `<img src="${artwork.get(emoji)}" width="128" height="128" style="width: 1em; height: 1em;" />`;
  });
}
