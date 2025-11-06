import { lazy, Suspense, type HTMLAttributes } from "react";
import type { LucideProps } from "lucide-react";
import dynamicIconImports from "lucide-react/dynamicIconImports";

export interface IconProps extends Omit<LucideProps, "ref"> {
  name: `#lucide/${keyof typeof dynamicIconImports}`;
}

const iconCache = new Map<string, React.ComponentType<LucideProps>>();

function getOrCreateIcon(prefixedName: IconProps["name"]) {
  const name = prefixedName.replace(
    "#lucide/",
    "",
  ) as keyof typeof dynamicIconImports;
  let LucideIcon = iconCache.get(name);

  if (!LucideIcon) {
    const fn =
      dynamicIconImports[name] ??
      (() => Promise.resolve({ default: FallbackIcon }));
    const promise = fn();
    void promise.then((mod) => {
      iconCache.set(name, mod.default);
    });
    LucideIcon = lazy(() => promise);
    iconCache.set(name, LucideIcon);
  }

  return LucideIcon;
}

export const Icon = ({ ...props }: IconProps) => {
  return <IconWithFallback {...props} />;
};

function FallbackIcon({ name, ...props }: IconProps) {
  const fallbackStyle = {
    width: props.size || props.width,
    height: props.size || props.height,
    backgroundColor: props.color || "currentColor",
    opacity: 0.1,
    borderRadius: "999999px",
  };

  return (
    <div {...(props as HTMLAttributes<HTMLDivElement>)} style={fallbackStyle} />
  );
}

export const IconWithFallback = ({ name, ...props }: IconProps) => {
  const LucideIcon = getOrCreateIcon(name);

  return (
    <Suspense fallback={<FallbackIcon name={name} {...props} />}>
      {/* eslint-disable-next-line react-hooks/static-components -- getOrCreateIcon returns cached components */}
      <LucideIcon {...props} />
    </Suspense>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function preloadIcon(name: IconProps["name"]) {
  getOrCreateIcon(name);
}
