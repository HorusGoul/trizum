import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";
import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import { Trans, useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { toast } from "sonner";
import { analyticsCampaignSchema } from "@trizum/analytics";
import { Button } from "@trizum/ui/Button";
import { Icon } from "@trizum/ui/Icon";
import { QRCode } from "@trizum/ui/QRCode";
import { Alert, AlertDescription } from "@trizum/ui/Alert";
import {
  createAiInviteUrl,
  parseAiInviteSearch,
  createAiHandoffUrl,
  createNativePartyUrl,
  NATIVE_APP_ORIGIN,
  AI_HANDOFF_ORIGIN,
} from "#src/lib/aiInvite.ts";
import { detectMobilePlatform, getAppStoreUrl, type MobilePlatform } from "#src/lib/appStores.ts";
import { getAppLink } from "#src/lib/link.ts";
import { guardPartyExists } from "#src/lib/guards.ts";
import { trackEvent } from "#src/lib/analytics.ts";
import { PartyPendingComponent } from "#src/components/PartyPendingComponent.tsx";

const qrOptions = {
  backgroundOptions: { color: "#ffffff" },
  dotsOptions: { color: "#000000" },
  cornersSquareOptions: { color: "#000000" },
  cornersDotOptions: { color: "#000000" },
};

export const Route = createFileRoute("/party_/$partyId/continue")({
  component: AiInvite,
  pendingComponent: PartyPendingComponent,
  validateSearch: parseAiInviteSearch,
  beforeLoad: ({ params, search }) => {
    if (!isValidDocumentId(params.partyId)) throw redirect({ to: "/join", replace: true });

    if (Capacitor.isNativePlatform())
      throw redirect({ to: "/party/$partyId", params, search: { tab: "expenses" }, replace: true });

    if (window.location.origin === NATIVE_APP_ORIGIN) {
      throw redirect({
        href: createAiHandoffUrl(params.partyId, search),
        replace: true,
        reloadDocument: true,
      });
    }
  },
  loader: async ({ context, params }) => ({
    party: await guardPartyExists(params.partyId, context),
  }),
});

function StoreLink({ platform }: { platform: MobilePlatform }) {
  return (
    <a
      href={getAppStoreUrl(platform)}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      onClick={() =>
        trackEvent(
          platform === "ios" ? "ai_handoff_app_store_requested" : "ai_handoff_play_store_requested",
        )
      }
      className="bg-accent-500 text-accent-50 hover:bg-accent-600 dark:hover:bg-accent-400 flex min-h-12 items-center justify-center gap-3 rounded-full px-5 py-3 font-semibold outline-offset-4"
    >
      <Icon
        icon={platform === "ios" ? "brand.app-store" : "brand.google-play"}
        className="size-5"
      />
      {platform === "ios" ? (
        <Trans>Download on the App Store</Trans>
      ) : (
        <Trans>Get it on Google Play</Trans>
      )}
    </a>
  );
}

function AiInvite() {
  const { party } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { t } = useLingui();
  const [copyFailed, setCopyFailed] = useState(false);
  const platform = detectMobilePlatform(navigator.userAgent, navigator.maxTouchPoints);
  const campaign = analyticsCampaignSchema.safeParse(search);

  const inviteUrl = createAiInviteUrl(
    window.location.origin === AI_HANDOFF_ORIGIN ? NATIVE_APP_ORIGIN : getAppLink("/"),
    party.id,
    campaign.success ? campaign.data : undefined,
  );

  const appUrl = createNativePartyUrl(party.id, campaign.success ? campaign.data : undefined);

  return (
    <main className="container flex min-h-full flex-col justify-center gap-8 px-5 py-10 sm:px-8">
      <header className="space-y-4">
        <img
          src="/pwa-192x192.png"
          alt="trizum"
          width={64}
          height={64}
          className="size-16 rounded-2xl"
        />
        <h1 className="text-3xl font-bold tracking-tight">
          <Trans>Your group is ready</Trans>
        </h1>
        <h2 className="text-xl font-semibold wrap-anywhere">
          {party.symbol} {party.name}
        </h2>
        <p className="text-accent-700 dark:text-accent-200 leading-relaxed">
          <Trans>Get the app to track shared expenses with your group, even offline.</Trans>
        </p>
      </header>

      <div className="space-y-4">
        <div className={platform ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"}>
          {platform !== "android" && <StoreLink platform="ios" />}
          {platform !== "ios" && <StoreLink platform="android" />}
        </div>
        <p className="text-accent-700 dark:text-accent-200 text-sm leading-relaxed">
          <Trans>
            After installing, reopen this invite to join your group. No account is needed.
          </Trans>
        </p>
        <a
          href={appUrl}
          rel="noreferrer"
          referrerPolicy="no-referrer"
          className="text-accent-700 dark:text-accent-200 block text-sm underline underline-offset-4"
          onClick={() => trackEvent("ai_handoff_app_open_requested")}
        >
          <Trans>Already have trizum? Open your group</Trans>
        </a>
      </div>

      {!platform && (
        <section className="bg-accent-100 dark:bg-accent-900 flex flex-col items-center gap-3 rounded-2xl p-5">
          <h3 className="font-medium">
            <Trans>Open this invite on your phone</Trans>
          </h3>
          <figure aria-label={t`Invite QR code`} className="rounded-xl bg-white p-2">
            <QRCode value={inviteUrl} size="xl" options={qrOptions} />
          </figure>
        </section>
      )}

      <div className="space-y-3">
        <Button
          color="input-like"
          pressAction={async () => {
            trackEvent("ai_handoff_web_continue_requested");

            if (window.location.origin === AI_HANDOFF_ORIGIN) {
              window.location.replace(appUrl);

              return;
            }

            await navigate({
              to: "/party/$partyId",
              params: { partyId: party.id },
              search: { tab: "expenses" },
              replace: true,
            });
          }}
        >
          <Trans>Continue on the web</Trans>
        </Button>
        <Button
          pressAction={async () => {
            setCopyFailed(false);

            try {
              await navigator.clipboard.writeText(inviteUrl);
              trackEvent("party_link_copied");
              toast.success(t`Party link copied to clipboard!`);
            } catch {
              setCopyFailed(true);
            }
          }}
        >
          <Icon icon="lucide.copy" className="mr-2 size-4" />
          <Trans>Copy invite link</Trans>
        </Button>
        {copyFailed && (
          <Alert>
            <AlertDescription>
              <Trans>Select this link to copy your invite:</Trans>
              <code className="break-all select-all">{inviteUrl}</code>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </main>
  );
}
