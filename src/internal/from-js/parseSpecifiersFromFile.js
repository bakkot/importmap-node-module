import { createRequire } from "module"
import { readFile, urlToFileSystemPath } from "@jsenv/util"

const require = createRequire(import.meta.url)

const parser = require("@babel/parser")
const traverse = require("@babel/traverse")

export const parseSpecifiersFromFile = async (
  fileUrl,
  {
    fileContent,
    sourceType = "module",
    allowImportExportEverywhere = true,
    allowAwaitOutsideFunction = true,
    ranges = true,
    jsx = true,
    typescript = true,
    flow = false,
    ...options
  } = {},
) => {
  fileContent = fileContent === undefined ? await readFile(fileUrl, { as: "string" }) : fileContent

  const ast = parser.parse(fileContent, {
    sourceType,
    sourceFilename: urlToFileSystemPath(fileUrl),
    allowImportExportEverywhere,
    allowAwaitOutsideFunction,
    ranges,
    plugins: [
      // "estree",
      "topLevelAwait",
      "exportDefaultFrom",
      ...(jsx ? ["jsx"] : []),
      ...(typescript ? ["typescript"] : []),
      ...(flow ? ["jsx"] : []),
    ],
    ...options,
  })

  const specifiers = {}

  const addSpecifier = ({ path, type }) => {
    const specifier = path.node.value
    specifiers[specifier] = {
      line: path.node.loc.start.line,
      column: path.node.loc.start.column,
      type,
    }
  }

  traverse.default(ast, {
    // ImportExpression: (path) => {
    //   if (path.node.arguments[0].type !== "StringLiteral") {
    //     // Non-string argument, probably a variable or expression, e.g.
    //     // import(moduleId)
    //     // import('./' + moduleName)
    //     return
    //   }
    //   addSpecifier(path.get("arguments")[0])
    // },
    CallExpression: (path) => {
      if (path.node.callee.type !== "Import") {
        // Some other function call, not import();
        return
      }
      if (path.node.arguments[0].type !== "StringLiteral") {
        // Non-string argument, probably a variable or expression, e.g.
        // import(moduleId)
        // import('./' + moduleName)
        return
      }
      addSpecifier({
        path: path.get("arguments")[0],
        type: "import-dynamic",
      })
    },
    ExportAllDeclaration: (path) => {
      addSpecifier({
        path: path.get("source"),
        type: "export-all",
      })
    },
    ExportNamedDeclaration: (path) => {
      if (!path.node.source) {
        // This export has no "source", so it's probably
        // a local variable or function, e.g.
        // export { varName }
        // export const constName = ...
        // export function funcName() {}
        return
      }
      addSpecifier({
        path: path.get("source"),
        type: "export-named",
      })
    },
    ImportDeclaration: (path) => {
      addSpecifier({
        path: path.get("source"),
        type: "import-static",
      })
    },
  })

  return specifiers
}
