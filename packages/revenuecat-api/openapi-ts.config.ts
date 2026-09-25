import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "https://www.revenuecat.com/docs/redocusaurus/openapi-v2-customer-resources.yaml",
  output: {
    module: { extension: ".js" },
    path: "src/generated",
  },
});
