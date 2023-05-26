import { assert } from "@jsenv/assert";
import { resolveUrl, urlToFileSystemPath } from "@jsenv/urls";

import { writeImportMapFiles } from "@jsenv/importmap-node-module";

const testDirectoryUrl = resolveUrl("./root/", import.meta.url);
const test = async ({ magicExtensions, packagesManualOverrides } = {}) => {
  const warnings = [];
  const importmaps = await writeImportMapFiles({
    projectDirectoryUrl: testDirectoryUrl,
    importMapFiles: {
      "test.importmap": {
        mappingsForNodeResolution: true,
        entryPointsToCheck: ["./main.js"],
        removeUnusedMappings: true,
        magicExtensions,
      },
    },
    packagesManualOverrides,
    onWarn: (warning) => {
      warnings.push(warning);
    },
    writeFiles: false,
  });
  return { warnings, importmaps };
};

{
  const actual = await test({
    magicExtensions: [".ts"],
    packagesManualOverrides: {
      lodash: {
        exports: {
          "./*": "./*",
        },
      },
    },
  });
  const importedFilePath = urlToFileSystemPath(
    `${testDirectoryUrl}node_modules/lodash/union`,
  );
  const expected = {
    warnings: [
      {
        code: "IMPORT_RESOLUTION_FAILED",
        message: `Import resolution failed for "lodash/union"
--- import trace ---
${testDirectoryUrl}main.js:2:22
  1 | // eslint-disable-next-line import/no-unresolved
> 2 | import { union } from "lodash/union";
    |                      ^
  3 | 
--- reason ---
file not found on filesystem at ${importedFilePath}`,
      },
    ],
    importmaps: {
      "test.importmap": {
        imports: {
          "lodash/": "./node_modules/lodash/",
        },
        scopes: {},
      },
    },
  };
  assert({ actual, expected });
}

{
  const actual = await test({
    magicExtensions: [".js"],
    packagesManualOverrides: {
      lodash: {
        exports: {
          "./*": "./*",
        },
      },
    },
  });
  const expected = {
    warnings: [],
    importmaps: {
      "test.importmap": {
        imports: {
          "lodash/union": "./node_modules/lodash/union.js",
          "lodash/": "./node_modules/lodash/",
        },
        scopes: {},
      },
    },
  };
  assert({ actual, expected });
}
