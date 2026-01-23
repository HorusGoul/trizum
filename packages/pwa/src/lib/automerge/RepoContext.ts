/**
 * @deprecated RepoContext is no longer used. Use TrizumProvider from @trizum/sdk instead.
 * This file exists only for backwards compatibility during migration.
 */

import { createContext } from "react";

/**
 * @deprecated Use TrizumProvider from @trizum/sdk instead.
 */
export const RepoContext = createContext<unknown>(null);
