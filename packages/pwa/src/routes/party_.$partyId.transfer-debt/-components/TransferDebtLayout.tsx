import { t } from "@lingui/core/macro";
import { BackButton } from "#src/components/BackButton.tsx";
import { IconButton } from "#src/ui/IconButton.tsx";

export function TransferDebtLayout({
  title,
  children,
  showBackButton = true,
  onBackPress,
}: {
  title: string;
  children: React.ReactNode;
  showBackButton?: boolean;
  onBackPress?: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="mt-safe container flex h-16 items-center px-2">
        {showBackButton ? (
          onBackPress ? (
            <IconButton
              icon="lucide.arrow-left"
              aria-label={t`Go Back`}
              className="shrink-0"
              onPress={onBackPress}
            />
          ) : (
            <BackButton fallbackOptions={{ to: "/party/$partyId" }} />
          )
        ) : (
          <div className="h-10 w-10 shrink-0" />
        )}
        <h1 className="max-h-12 truncate px-4 text-xl font-medium">{title}</h1>
      </div>

      {children}
    </div>
  );
}
