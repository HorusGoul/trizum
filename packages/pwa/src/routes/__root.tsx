import type { AppData } from "#src/lib/data/client.ts";
import { createRootRouteWithContext, Outlet, useLocation, useRouter } from "@tanstack/react-router";
import { RouterProvider } from "react-aria-components";
import { shouldReplaceNavigation } from "#src/lib/navigationHistory.ts";
import { AdvertisingController } from "#src/components/AdvertisingController.tsx";
import { AppRecoveryDialog } from "#src/components/AppRecoveryDialog.tsx";
import { isProtectedAdRoute } from "#src/lib/advertising/advertisingPolicy.ts";

interface RouterContext {
  data: AppData;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Root,
});

function Root() {
  const router = useRouter();
  const location = useLocation();
  const protectedFlow = isProtectedAdRoute(location.pathname, location.search);

  return (
    <AdvertisingController protectedFlow={protectedFlow}>
      <RouterProvider
        navigate={(to, options) => {
          const navigationOptions = {
            ...(to instanceof Object ? to : { to }),
            ...options,
          };

          const nextLocation = router.buildLocation(
            to instanceof Object ? navigationOptions : { to },
          );

          void router.navigate({
            ...navigationOptions,
            replace:
              navigationOptions.replace ??
              shouldReplaceNavigation(router.state.location.href, nextLocation.href),
          });
        }}
        useHref={(to) => {
          return router.buildLocation(to instanceof Object ? to : { to }).href;
        }}
      >
        <Outlet />
      </RouterProvider>
      <AppRecoveryDialog />
    </AdvertisingController>
  );
}
