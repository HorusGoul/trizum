import { Icon, type IconProps } from "#src/ui/Icon.js";

interface SupportLinkProps {
  href: string;
  icon: IconProps["icon"];
  title: string;
  description: string;
  linkText: string;
  isExternal?: boolean;
}

export function SupportLink({
  href,
  icon,
  title,
  description,
  linkText,
  isExternal,
}: SupportLinkProps) {
  const linkProps = isExternal ? { target: "_blank" as const, rel: "noopener noreferrer" } : {};

  return (
    <a
      href={href}
      {...linkProps}
      className="bg-accent-50 hover:bg-accent-100 focus-visible:ring-accent-500 dark:bg-accent-900 dark:hover:bg-accent-800 flex gap-4 rounded-lg p-4 outline-hidden transition-colors focus-visible:ring-2"
    >
      <div className="shrink-0">
        <div className="bg-accent-200 dark:bg-accent-700 flex h-12 w-12 items-center justify-center rounded-full">
          <Icon
            icon={icon}
            width={24}
            height={24}
            className="text-accent-700 dark:text-accent-300"
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <h3 className="text-accent-900 dark:text-accent-100 font-semibold">{title}</h3>
        <p className="text-accent-600 dark:text-accent-400 text-sm">{description}</p>
        <span className="text-accent-700 dark:text-accent-300 mt-1 inline-flex items-center gap-1 text-sm font-medium">
          {linkText}
          {isExternal && (
            <Icon icon="lucide.external-link" width={14} height={14} className="text-accent-500" />
          )}
        </span>
      </div>
    </a>
  );
}
