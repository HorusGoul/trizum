import type { ReactNode } from "react";
import { Icon, type IconProps } from "#src/ui/Icon.js";

interface FeatureItemProps {
  icon: IconProps["icon"];
  title: ReactNode;
  description: ReactNode;
}

export function FeatureItem({ icon, title, description }: FeatureItemProps) {
  return (
    <li className="flex gap-3">
      <div className="flex-shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-100 dark:bg-accent-800">
          <Icon
            icon={icon}
            width={20}
            height={20}
            className="text-accent-700 dark:text-accent-300"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <h4 className="font-semibold text-accent-900 dark:text-accent-100">{title}</h4>
        <p className="text-sm text-accent-600 dark:text-accent-400">{description}</p>
      </div>
    </li>
  );
}
