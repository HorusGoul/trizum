import type { ReactNode } from "react";
import { Icon, type IconProps } from "@trizum/ui/Icon";

export function PartySettingsSection({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: IconProps["icon"];
  title: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
        <Icon icon={icon} width={16} height={16} />
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}
