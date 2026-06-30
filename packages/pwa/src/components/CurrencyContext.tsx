import type { CurrencyCode } from "#src/lib/money.ts";
import { createContext } from "react";

export const CurrencyContext = createContext<CurrencyCode>("EUR");
