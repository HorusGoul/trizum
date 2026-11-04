/// <reference types="node" />

import { describe, it } from "node:test";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import { noModuleMockingRule } from "./anti-slop/rules/no-module-mocking.ts";

RuleTester.describe = (name, run) => {
  void describe(name, run);
};

RuleTester.it = (name, run) => {
  void it(name, run);
};

const tester = new RuleTester();

tester.run("no-module-mocking", noModuleMockingRule, {
  valid: [
    'import { vi } from "vite-plus/test"; vi.fn(); vi.spyOn(service, "read");',
    'import { vi } from "another-library"; vi.mock("service");',
    'import { vi } from "vite-plus/test"; function example(vi) { vi.mock("service"); }',
    'import { vi as testApi } from "vite-plus/test"; const vi = { mock() {} }; vi.mock("service"); testApi.fn();',
  ],
  invalid: [
    ...["vite-plus/test", "vitest"].flatMap((source) => [
      {
        code: `import { vi } from "${source}"; vi.mock("service");`,
        errors: [{ messageId: "moduleMock" }],
      },
      {
        code: `import { vi as testApi } from "${source}"; testApi.doMock("service");`,
        errors: [{ messageId: "moduleMock" }],
      },
      {
        code: `import { vi as testApi } from "${source}"; testApi["mock"]("service");`,
        errors: [{ messageId: "moduleMock" }],
      },
    ]),
    {
      code: 'import { jest as testApi } from "@jest/globals"; testApi.unstable_mockModule("service");',
      errors: [{ messageId: "moduleMock" }],
    },
    {
      code: 'vi.mock("service");',
      errors: [{ messageId: "moduleMock" }],
      languageOptions: { globals: { vi: "readonly" } },
    },
    {
      code: 'jest.mock("service");',
      errors: [{ messageId: "moduleMock" }],
      languageOptions: { globals: { jest: "readonly" } },
    },
  ],
});
