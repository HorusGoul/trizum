export function SectionIntro({
  eyebrow,
  title,
  titleId,
}: {
  eyebrow: string;
  title: string;
  titleId?: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-500 dark:text-accent-400">
        {eyebrow}
      </div>
      <h2 id={titleId} className="mt-2 text-2xl font-semibold tracking-tight">
        {title}
      </h2>
    </div>
  );
}
