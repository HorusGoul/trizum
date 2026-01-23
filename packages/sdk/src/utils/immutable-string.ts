/**
 * ImmutableString - A string type that is stored as an immutable value in documents.
 *
 * Use this for large binary data (like base64-encoded files) that shouldn't
 * be tracked for character-by-character changes. This provides better performance
 * and storage efficiency for data that is replaced wholesale rather than edited.
 *
 * @example
 * ```ts
 * import { ImmutableString } from "@trizum/sdk";
 *
 * // Create an immutable string for storing binary data
 * const encodedImage = new ImmutableString(base64Data);
 *
 * // Use it in a document
 * client.create({
 *   type: "mediaFile",
 *   encodedBlob: encodedImage,
 * });
 * ```
 */

// We use a factory pattern to hide the internal implementation from the public type system

import { RawString } from "@automerge/automerge-repo/slim";

/**
 * Interface for ImmutableString - defines the public API.
 */
export interface ImmutableString {
  /** The string value */
  readonly val: string;
}

/**
 * Constructor type for ImmutableString.
 */
export interface ImmutableStringConstructor {
  new (value: string): ImmutableString;
}

// Create the ImmutableString class using RawString internally
class ImmutableStringImpl extends RawString {
  constructor(value: string) {
    super(value);
  }

  toJSON(): string {
    return this.val;
  }

  override toString(): string {
    return this.val;
  }

  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return `ImmutableString("${this.val.substring(0, 50)}${this.val.length > 50 ? "..." : ""}")`;
  }
}

/**
 * A string that will be stored as an immutable value in documents.
 *
 * Use this for large binary data (like base64-encoded files) that shouldn't
 * be tracked for character-by-character changes.
 */
export const ImmutableString: ImmutableStringConstructor =
  ImmutableStringImpl as unknown as ImmutableStringConstructor;
