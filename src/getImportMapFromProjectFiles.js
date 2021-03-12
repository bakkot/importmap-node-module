import { sortImportMap, composeTwoImportMaps } from "@jsenv/import-map"
import { getImportMapFromJsFiles } from "./internal/from-js/getImportMapFromJsFiles.js"
import { getImportMapFromPackageFiles } from "./internal/from-package/getImportMapFromPackageFiles.js"

export const getImportMapFromProjectFiles = async ({
  logLevel,
  projectDirectoryUrl,
  runtime = "browser",
  moduleFormat = "esm",
  dev = false,
  jsFiles = false,
  removeUnusedMappings = !dev,
  magicExtensions,
  onWarn,
  ...rest
}) => {
  const packagesExportsPreference = [
    ...(moduleFormatPreferences[moduleFormat] || [moduleFormat]),
    ...(runtimeExportsPreferences[runtime] || [runtime]),
    ...(dev ? "development" : "production"),
  ]

  // At this point, importmap is relative to the project directory url
  let importMapFromPackageFiles = await getImportMapFromPackageFiles({
    logLevel,
    projectDirectoryUrl,
    packagesExportsPreference,
    projectPackageDevDependenciesIncluded: dev,
    ...rest,
  })
  importMapFromPackageFiles = sortImportMap(importMapFromPackageFiles)

  let importMapFromJsFiles = jsFiles
    ? await getImportMapFromJsFiles({
        logLevel,
        onWarn,
        importMap: importMapFromPackageFiles,
        removeUnusedMappings,
        projectDirectoryUrl,
        magicExtensions,
        packagesExportsPreference,
        runtime,
      })
    : {}
  importMapFromJsFiles = sortImportMap(importMapFromJsFiles)

  return sortImportMap(composeTwoImportMaps(importMapFromPackageFiles, importMapFromJsFiles))
}

const runtimeExportsPreferences = {
  browser: ["browser"],
  node: ["node"],
}

const moduleFormatPreferences = {
  esm: ["import"],
  cjs: ["require"],
}
