import { lazy, Suspense, type HTMLAttributes } from "react";
import type { LucideProps } from "lucide-react";
import dynamicIconImports from "lucide-react/dynamicIconImports";

export interface IconProps extends Omit<LucideProps, "ref"> {
  name: `#lucide/${keyof typeof dynamicIconImports}`;
}

const iconCache = new Map<string, React.ComponentType<LucideProps>>();

function getOrCreateIcon(name: keyof typeof dynamicIconImports) {
  let LucideIcon = iconCache.get(name);

  if (!LucideIcon) {
    const fn = dynamicIconImports[name];
    const promise = fn();
    LucideIcon = lazy(() => promise);
    iconCache.set(name, LucideIcon);
  }

  return LucideIcon;
}

export const Icon = ({ ...props }: IconProps) => {
  return <IconWithFallback {...props} />;
};

export const IconWithFallback = ({ name, ...props }: IconProps) => {
  const LucideIcon = getOrCreateIcon(
    name.replace("#lucide/", "") as keyof typeof dynamicIconImports,
  );

  const fallbackStyle = {
    width: props.size || props.width,
    height: props.size || props.height,
    backgroundColor: props.color || "currentColor",
    opacity: 0.1,
    borderRadius: "999999px",
  };

  return (
    <Suspense
      fallback={
        <div
          {...(props as HTMLAttributes<HTMLDivElement>)}
          style={fallbackStyle}
        />
      }
    >
      <LucideIcon {...props} />
    </Suspense>
  );
};

export function preloadIcon(name: keyof typeof dynamicIconImports) {
  getOrCreateIcon(name);
}
