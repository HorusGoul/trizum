import { Icon, type IconProps } from "@trizum/ui/Icon";

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
      className="flex gap-4 rounded-lg bg-neutral-50 p-4 outline-hidden transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-500 dark:bg-neutral-900 dark:hover:bg-neutral-800"
    >
      <div className="shrink-0">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700">
          <Icon
            icon={icon}
            width={24}
            height={24}
            className="text-neutral-700 dark:text-neutral-300"
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
        <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {linkText}
          {isExternal && (
            <Icon icon="lucide.external-link" width={14} height={14} className="text-neutral-500" />
          )}
        </span>
      </div>
    </a>
  );
}
