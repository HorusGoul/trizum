import type { Currency } from "#src/lib/money.js";
import { createContext } from "react";

export const CurrencyContext = createContext<Currency>("EUR");
