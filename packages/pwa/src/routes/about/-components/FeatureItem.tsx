import type { ReactNode } from "react";
import { Icon, type IconProps } from "@trizum/ui/Icon";

interface FeatureItemProps {
  icon: IconProps["icon"];
  title: ReactNode;
  description: ReactNode;
}

export function FeatureItem({ icon, title, description }: FeatureItemProps) {
  return (
    <li className="flex gap-3">
      <div className="shrink-0">
        <div className="shadow-surface flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-neutral-900">
          <Icon
            icon={icon}
            width={20}
            height={20}
            className="text-neutral-700 dark:text-neutral-300"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <h4 className="font-semibold text-neutral-950 dark:text-neutral-50">{title}</h4>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
      </div>
    </li>
  );
}
