import { useId } from "react";
import type { SVGProps } from "react";
import spriteHref from "#src/generated/iconSprite.svg?url";
import type { SpriteId } from "#src/generated/iconSprite.gen.js";

export interface IconProps extends SVGProps<SVGSVGElement> {
  icon: SpriteId;
  title?: string;
}

export function Icon({
  "aria-hidden": ariaHidden,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  height = 24,
  icon,
  title,
  width = 24,
  ...props
}: IconProps) {
  const generatedTitleId = useId();
  const titleId =
    title && !ariaLabel && !ariaLabelledBy ? generatedTitleId : undefined;
  const isDecorative = ariaHidden ?? (!ariaLabel && !ariaLabelledBy && !title);

  return (
    <svg
      {...props}
      aria-hidden={isDecorative}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy ?? titleId}
      focusable="false"
      height={height}
      width={width}
    >
      {titleId ? <title id={titleId}>{title}</title> : null}
      <use href={`${spriteHref}#${icon}`} />
    </svg>
  );
}
