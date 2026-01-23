/**
 * SDK-specific types that provide a clean public API.
 *
 * These types abstract away internal implementation details.
 */

/**
 * A unique identifier for a document in the Trizum system.
 * This is an opaque string type that should not be manipulated directly.
 */
export type DocumentId = string & { readonly __brand: "DocumentId" };

/**
 * Type for document IDs that can be passed to hooks and cache functions.
 * Accepts both strongly-typed DocumentId and plain strings for flexibility.
 */
export type AnyDocumentId = DocumentId | string;

// Import the internal validator
import { isValidDocumentId as internalIsValidDocumentId } from "./internal/automerge.js";

/**
 * Check if a string is a valid document ID.
 *
 * @param id - The string to check
 * @returns True if the string is a valid document ID, with type narrowing
 */
export function isValidDocumentId(id: string): id is DocumentId {
  return internalIsValidDocumentId(id);
}

/**
 * A handle to a document that allows reading and modifying it.
 * This is an opaque type that wraps the underlying document handle.
 */
export interface DocumentHandle<T> {
  /** The unique identifier of this document */
  readonly documentId: DocumentId;
  /** Get the current state of the document */
  doc(): T | undefined;
  /** Apply a change to the document */
  change(fn: (doc: T) => void): void;
  /** Check if the document is in a loading state */
  isLoading(): boolean;
  /** Check if the document has been deleted */
  isDeleted(): boolean;
  /** Check if the document is in any of the given states */
  inState(states: string[]): boolean;
  /** Subscribe to document changes */
  on(
    event: "change" | "delete" | "ephemeral-message",
    callback: (payload?: unknown) => void,
  ): () => void;
  /** Unsubscribe from document changes */
  off(
    event: "change" | "delete" | "ephemeral-message",
    callback: (payload?: unknown) => void,
  ): void;
  /** Broadcast an ephemeral message to all connected peers */
  broadcast(message: unknown): void;
}

/**
 * Supported locales in the Trizum application.
 */
export const SUPPORTED_LOCALES = ["en", "es"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Currency code (ISO 4217).
 * This type is compatible with dinero.js Currency type.
 */
export type CurrencyCode =
  | "AED"
  | "AFN"
  | "ALL"
  | "AMD"
  | "ANG"
  | "AOA"
  | "ARS"
  | "AUD"
  | "AWG"
  | "AZN"
  | "BAM"
  | "BBD"
  | "BDT"
  | "BGN"
  | "BHD"
  | "BIF"
  | "BMD"
  | "BND"
  | "BOB"
  | "BOV"
  | "BRL"
  | "BSD"
  | "BTN"
  | "BWP"
  | "BYN"
  | "BZD"
  | "CAD"
  | "CDF"
  | "CHE"
  | "CHF"
  | "CHW"
  | "CLF"
  | "CLP"
  | "CNY"
  | "COP"
  | "COU"
  | "CRC"
  | "CUC"
  | "CUP"
  | "CVE"
  | "CZK"
  | "DJF"
  | "DKK"
  | "DOP"
  | "DZD"
  | "EGP"
  | "ERN"
  | "ETB"
  | "EUR"
  | "FJD"
  | "FKP"
  | "GBP"
  | "GEL"
  | "GHS"
  | "GIP"
  | "GMD"
  | "GNF"
  | "GTQ"
  | "GYD"
  | "HKD"
  | "HNL"
  | "HRK"
  | "HTG"
  | "HUF"
  | "IDR"
  | "ILS"
  | "INR"
  | "IQD"
  | "IRR"
  | "ISK"
  | "JMD"
  | "JOD"
  | "JPY"
  | "KES"
  | "KGS"
  | "KHR"
  | "KMF"
  | "KPW"
  | "KRW"
  | "KWD"
  | "KYD"
  | "KZT"
  | "LAK"
  | "LBP"
  | "LKR"
  | "LRD"
  | "LSL"
  | "LYD"
  | "MAD"
  | "MDL"
  | "MGA"
  | "MKD"
  | "MMK"
  | "MNT"
  | "MOP"
  | "MRU"
  | "MUR"
  | "MVR"
  | "MWK"
  | "MXN"
  | "MXV"
  | "MYR"
  | "MZN"
  | "NAD"
  | "NGN"
  | "NIO"
  | "NOK"
  | "NPR"
  | "NZD"
  | "OMR"
  | "PAB"
  | "PEN"
  | "PGK"
  | "PHP"
  | "PKR"
  | "PLN"
  | "PYG"
  | "QAR"
  | "RON"
  | "RSD"
  | "RUB"
  | "RWF"
  | "SAR"
  | "SBD"
  | "SCR"
  | "SDG"
  | "SEK"
  | "SGD"
  | "SHP"
  | "SLL"
  | "SOS"
  | "SRD"
  | "SSP"
  | "STN"
  | "SVC"
  | "SYP"
  | "SZL"
  | "THB"
  | "TJS"
  | "TMT"
  | "TND"
  | "TOP"
  | "TRY"
  | "TTD"
  | "TWD"
  | "TZS"
  | "UAH"
  | "UGX"
  | "USD"
  | "USN"
  | "UYI"
  | "UYU"
  | "UYW"
  | "UZS"
  | "VES"
  | "VND"
  | "VUV"
  | "WST"
  | "XAF"
  | "XAG"
  | "XAU"
  | "XBA"
  | "XBB"
  | "XBC"
  | "XBD"
  | "XCD"
  | "XDR"
  | "XOF"
  | "XPD"
  | "XPF"
  | "XPT"
  | "XSU"
  | "XTS"
  | "XUA"
  | "XXX"
  | "YER"
  | "ZAR"
  | "ZMW"
  | "ZWL";

/**
 * Event payload types for document handle events.
 * These abstract the underlying document event types.
 */

/**
 * Payload for document change events.
 */
export interface DocumentChangePayload<T> {
  /** The current document state after the change */
  doc: T;
  /** The document handle that changed */
  handle: DocumentHandle<T>;
  /** Additional patch information */
  patchInfo?: {
    /** The document before the change */
    before: T;
    /** The document after the change */
    after: T;
  };
}

/**
 * Payload for ephemeral (presence) message events.
 */
export interface EphemeralMessagePayload<T = unknown> {
  /** The message content */
  message: T;
  /** The peer ID that sent the message */
  senderId: string;
}
