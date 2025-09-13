import { cn, type ClassName } from "./utils";

interface AvatarProps {
  url?: string;
  name?: string;
  className?: ClassName;
  style?: React.CSSProperties;
}

const colorSchemes = [
  { bg: "bg-accent-500 dark:bg-accent-600", text: "text-accent-50" },
  { bg: "bg-slate-500 dark:bg-slate-600", text: "text-slate-50" },
  { bg: "bg-red-500 dark:bg-red-600", text: "text-red-50" },
  { bg: "bg-green-500 dark:bg-green-600", text: "text-green-50" },
  { bg: "bg-yellow-500 dark:bg-yellow-600", text: "text-yellow-50" },
  { bg: "bg-blue-500 dark:bg-blue-600", text: "text-blue-50" },
  { bg: "bg-purple-500 dark:bg-purple-600", text: "text-purple-50" },
  { bg: "bg-pink-500 dark:bg-pink-600", text: "text-pink-50" },
  { bg: "bg-gray-500 dark:bg-gray-600", text: "text-gray-50" },
  { bg: "bg-orange-500 dark:bg-orange-600", text: "text-orange-50" },
  { bg: "bg-teal-500 dark:bg-teal-600", text: "text-teal-50" },
  { bg: "bg-violet-500 dark:bg-violet-600", text: "text-violet-50" },
  { bg: "bg-rose-500 dark:bg-rose-600", text: "text-rose-50" },
  { bg: "bg-amber-500 dark:bg-amber-600", text: "text-amber-50" },
  { bg: "bg-cyan-500 dark:bg-cyan-600", text: "text-cyan-50" },
  { bg: "bg-emerald-500 dark:bg-emerald-600", text: "text-emerald-50" },
  { bg: "bg-sky-500 dark:bg-sky-600", text: "text-sky-50" },
  { bg: "bg-lime-500 dark:bg-lime-600", text: "text-lime-50" },
  { bg: "bg-fuchsia-500 dark:bg-fuchsia-600", text: "text-fuchsia-50" },
  { bg: "bg-indigo-500 dark:bg-indigo-600", text: "text-indigo-50" },
];

export function Avatar({ url, name, className, style }: AvatarProps) {
  const colorScheme = getColorScheme(name ?? "default");

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full text-xs font-bold",
        className,
        colorScheme.bg,
        colorScheme.text,
      )}
      style={style}
    >
      {name ? getInitials(name) : null}
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
}

function getColorScheme(name: string) {
  const initials = getInitials(name);
  return colorSchemes[initials.charCodeAt(0) % colorSchemes.length];
}
