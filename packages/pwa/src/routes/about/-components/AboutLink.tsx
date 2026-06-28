import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Icon, type IconProps } from "#src/ui/Icon.js";

interface AboutLinkProps {
  href: string;
  icon?: IconProps["icon"];
  label: ReactNode;
  isInternal?: boolean;
}

export function AboutLink({ href, icon, label, isInternal }: AboutLinkProps) {
  const className =
    "flex items-center gap-3 rounded-lg bg-accent-50 px-4 py-3 text-accent-900 outline-none transition-colors hover:bg-accent-100 focus-visible:ring-2 focus-visible:ring-accent-500 dark:bg-accent-900 dark:text-accent-100 dark:hover:bg-accent-800";

  const content = (
    <>
      {icon && <Icon icon={icon} width={20} height={20} />}
      <span className="flex-1">{label}</span>
      {!isInternal && (
        <Icon
          icon="lucide.external-link"
          width={16}
          height={16}
          className="text-accent-600 dark:text-accent-400"
        />
      )}
    </>
  );

  if (isInternal) {
    return (
      <Link to={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {content}
    </a>
  );
}
