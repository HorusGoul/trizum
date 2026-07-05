import type { Repo } from "@automerge/automerge-repo/slim";
import { createRootRouteWithContext, Outlet, useRouter } from "@tanstack/react-router";
import { RouterProvider } from "react-aria-components";
import { shouldReplaceNavigation } from "#src/lib/navigationHistory.ts";

interface RouterContext {
  repo: Repo;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Root,
});

function Root() {
  const router = useRouter();

  return (
    <RouterProvider
      navigate={(to, options) => {
        if (typeof to === "string") {
          const nextLocation = router.buildLocation({ to });
          void router.navigate({
            to,
            ...options,
            replace:
              options?.replace ??
              shouldReplaceNavigation(router.state.location.href, nextLocation.href),
          });
          return;
        }

        const navigationOptions = {
          ...to,
          ...options,
        };
        const nextLocation = router.buildLocation(navigationOptions);

        void router.navigate({
          ...navigationOptions,
          replace:
            navigationOptions.replace ??
            shouldReplaceNavigation(router.state.location.href, nextLocation.href),
        });
      }}
      useHref={(to) => {
        if (typeof to === "string") {
          return router.buildLocation({ to }).href;
        }

        return router.buildLocation(to).href;
      }}
    >
      <Outlet />
    </RouterProvider>
  );
}
