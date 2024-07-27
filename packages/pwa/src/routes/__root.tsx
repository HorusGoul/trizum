import type { Repo } from "@automerge/automerge-repo/slim";
import {
  createRootRouteWithContext,
  Outlet,
  useRouter,
} from "@tanstack/react-router";
import * as React from "react";
import { RouterProvider } from "react-aria-components";

const TanStackRouterDevtools = import.meta.env.PROD
  ? () => null // Render nothing in production
  : React.lazy(() =>
      // Lazy load in development
      import("@tanstack/router-devtools").then((res) => ({
        default: res.TanStackRouterDevtools,
      })),
    );

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
          router.navigate({ to, ...options });
          return;
        }

        router.navigate({
          ...to,
          ...options,
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
      <React.Suspense fallback={null}>
        <TanStackRouterDevtools />
      </React.Suspense>
    </RouterProvider>
  );
}
