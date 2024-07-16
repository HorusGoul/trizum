import { createRootRoute, Outlet, useRouter } from "@tanstack/react-router";
import * as React from "react";
import { RouterProvider } from "react-aria-components";

const TanStackRouterDevtools =
  process.env.NODE_ENV === "production"
    ? () => null // Render nothing in production
    : React.lazy(() =>
        // Lazy load in development
        import("@tanstack/router-devtools").then((res) => ({
          default: res.TanStackRouterDevtools,
        })),
      );

export const Route = createRootRoute({
  component: function RootRoute() {
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
  },
});
