import { getTrizumLogger } from "@trizum/logging";

export const rootLogger = getTrizumLogger("react-suspense-cache");

export function getLogger(...scope: string[]) {
  return getTrizumLogger("react-suspense-cache", ...scope);
}
