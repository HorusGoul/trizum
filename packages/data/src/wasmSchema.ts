import type { CompiledPermissions, WasmSchema } from "jazz-tools";

import { trizumJazzPermissions } from "./permissions.js";
import { trizumJazzApp } from "./schema.js";

export const trizumJazzWasmSchema = applyPermissionsToWasmSchema(
  trizumJazzApp.wasmSchema,
  trizumJazzPermissions,
);

function applyPermissionsToWasmSchema(
  wasmSchema: WasmSchema,
  permissions: CompiledPermissions,
): WasmSchema {
  const schemaWithPolicies = structuredClone(wasmSchema) as WasmSchema;

  for (const [tableName, tableSchema] of Object.entries(schemaWithPolicies)) {
    tableSchema.policies = permissions[tableName] as typeof tableSchema.policies;
  }

  return schemaWithPolicies;
}
