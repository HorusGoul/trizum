/**
 * Type definitions for document models.
 *
 * These types define the interface for creating type-safe document models
 * with the Trizum SDK.
 */

import type { DocumentId } from "../types.js";
import type { VersionedModel } from "./versioned.js";

/**
 * Base interface that all document models must implement.
 *
 * Documents in the Trizum SDK always have an `id` field that stores
 * their DocumentId for self-reference, and a schema version for migrations.
 */
export interface DocumentModel extends VersionedModel {
  /** The document's unique identifier (self-referential) */
  id: DocumentId;
  /** The document type discriminator */
  type: string;
}

/**
 * Definition for a document model, including how to create initial state.
 *
 * @typeParam T - The document model type
 * @typeParam CreateInput - The input type for creating new documents
 */
export interface DocumentModelDefinition<
  T extends DocumentModel,
  CreateInput = Omit<T, "id">,
> {
  /** The document type discriminator value */
  type: T["type"];

  /**
   * Create the initial state for a new document.
   *
   * @param input - The input data for creating the document
   * @returns The initial document state (id will be set automatically)
   */
  createInitialState: (input: CreateInput) => Omit<T, "id">;

  /**
   * Optional storage key for persisting document IDs locally.
   * Used for root documents like PartyList that need to persist their ID.
   */
  localStorageKey?: string;
}

/**
 * Helper functions generated for a document model.
 *
 * @typeParam T - The document model type
 */
export interface ModelHelpers<T extends DocumentModel> {
  /**
   * Create a new document with the given initial state.
   * @returns A tuple of [documentId, handle]
   */
  create: (input: Omit<T, "id">) => Promise<{
    id: DocumentId;
    doc: T;
  }>;

  /**
   * Find a document by its ID.
   * @returns The document if found, undefined otherwise
   */
  find: (id: DocumentId) => Promise<T | undefined>;

  /**
   * Update a document with a change function.
   * @param id - The document ID to update
   * @param changeFn - Function that receives the document and applies mutations
   */
  update: (id: DocumentId, changeFn: (doc: T) => void) => Promise<void>;

  /**
   * Delete a document.
   * @param id - The document ID to delete
   */
  delete: (id: DocumentId) => Promise<void>;

  /**
   * Subscribe to changes on a document.
   * @param id - The document ID to subscribe to
   * @param callback - Function called when the document changes
   * @returns Unsubscribe function
   */
  subscribe: (
    id: DocumentId,
    callback: (doc: T | undefined) => void,
  ) => () => void;
}
