import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { BackButton } from "#src/components/BackButton.tsx";
import { useCurrentParty } from "#src/hooks/useParty.ts";
import { Button } from "#src/ui/Button.tsx";
import { Icon } from "#src/ui/Icon.tsx";
import { QRCode } from "#src/ui/QRCode.tsx";
import { createFileRoute } from "@tanstack/react-router";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";
import { toast } from "sonner";
import { Share } from "@capacitor/share";
import { getAppLink } from "#src/lib/link.ts";

export const Route = createFileRoute("/party_/$partyId/share")({
  component: RouteComponent,
  pendingComponent: PartyPendingComponent,
  loader: async () => {
    return {
      canShare: await Share.canShare().then((result) => result.value),
    };
  },
});

function RouteComponent() {
  const { partyId, party } = useCurrentParty();
  const shareUrl = getAppLink(`/party/${partyId}`);
  const { canShare } = Route.useLoaderData();
  async function onShareParty() {
    if (canShare) {
      await Share.share({
        title: t`Join ${party.name} on trizum!`,
        url: shareUrl,
      });

      toast.success(t`Party shared!`);
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t`Party link copied to clipboard!`);
    } catch {
      prompt(
        t`Failed to copy party link to clipboard, please copy it manually`,
        shareUrl,
      );
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="container flex h-16 items-center px-2 mt-safe">
        <BackButton fallbackOptions={{ to: "/party/$partyId" }} />

        <h1 className="max-h-12 truncate px-4 text-xl font-medium">
          <Trans>Share party</Trans>
        </h1>
      </div>

      <div className="container mt-16 flex flex-1 flex-col items-center">
        <div className="relative flex aspect-square w-full max-w-60 items-center justify-center">
          <QRCode
            value={shareUrl}
            size="xl"
            className="rounded-lg text-accent-50"
            options={{
              image: getQRCodeImage(),
              imageOptions: {
                hideBackgroundDots: true,
                margin: 0,
                imageSize: 0.4,
              },
              dotsOptions: { color: "currentColor", type: "rounded" },
              cornersSquareOptions: { color: "currentColor", type: "rounded" },
              cornersDotOptions: { color: "currentColor", type: "rounded" },
              backgroundOptions: {
                color: "transparent",
              },
            }}
          />
        </div>

        <Button
          color="accent"
          className="mt-8 w-full max-w-56 rounded-lg font-medium"
          onPress={() => void onShareParty()}
        >
          {canShare ? (
            <>
              <Icon name="#lucide/share" className="mr-2 h-5 w-5" />
              <Trans>Share party</Trans>
            </>
          ) : (
            <>
              <Icon name="#lucide/copy" className="mr-2 h-5 w-5" />
              <Trans>Copy party link</Trans>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export function getQRCodeImage() {
  // Get color from CSS variable
  const variable = getComputedStyle(document.documentElement).getPropertyValue(
    "--accent-400",
  );

  const color = `oklch(${variable} / 1)`;

  const svg = `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path
    d="M138.738 197.734H356.862C356.862 197.734 397.947 197.734 397.947 166.36C397.947 134.986 356.862 134.986 356.862 134.986C335.199 134.986 311.295 134.986 301.584 161.878M273.945 232.843C273.945 232.843 238.089 317.254 199.245 357.592C185.578 371.785 174.594 377.014 154.425 377.014C134.256 377.014 113.388 366.556 114.087 344.893C114.786 323.23 138.738 323.23 138.738 323.23H176.835M273.945 323.23H356.862"
    stroke="${color}" stroke-width="17.928" stroke-linecap="round" />
</svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
