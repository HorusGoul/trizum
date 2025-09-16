import type { Currency } from "dinero.js";
import { createContext } from "react";

export const CurrencyContext = createContext<Currency>("EUR");
