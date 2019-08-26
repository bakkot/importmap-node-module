import { basename } from "path"
import {
  operatingSystemPathToPathname,
  pathnameToRelativePathname,
  pathnameToOperatingSystemPath,
} from "@jsenv/operating-system-path"
import { pathnameToDirname } from "@jsenv/module-resolution"
import { fileWrite } from "@dmail/helper"
import { catchAsyncFunctionCancellation } from "@dmail/cancellation"
import {
  resolveNodeModule,
  readPackageData,
  resolvePackageMain,
} from "./node-module-resolution/index.js"
import { sortImportMap } from "./sortImportMap.js"
import { mergeTwoImportMap } from "./mergeTwoImportMap.js"
import { importMapToVsCodeConfigPaths } from "./importMapToVsCodeConfigPaths.js"

export const generateImportMapForNodeModules = async ({
  projectPath,
  importMapRelativePath = "/importMap.json",
  inputImportMap = {},
  scopeOriginRelativePerModule = false, // import '/folder/file.js' is scoped per node_module
  remapMain = true, // import 'lodash' remapped to '/node_modules/lodash/index.js'
  remapFolder = true, // import 'lodash/src/file.js' remapped to '/node_modules/lodash/src/file.js'
  remapDevDependencies = true,
  remapPredicate = ({ isTopLevel, packageData }) => {
    if (isTopLevel) return true

    // jsenv do not remap modules without import/export
    // this is just a perf optimization.
    // other tools than jsenv might want the full import map
    // and would have to remove this logic
    if ("module" in packageData) return true
    if ("jsnext:main" in packageData) return true
    return false
  },
  writeImportMapFile = false,
  logImportMapFilePath = true,
  throwUnhandled = true,
  writeJsconfigFile = false,
  logJsConfigFilePath = true,
}) =>
  catchAsyncFunctionCancellation(async () => {
    const projectPathname = operatingSystemPathToPathname(projectPath)
    const topLevelPackagePathname = `${projectPathname}/package.json`
    const topLevelImporterName = basename(pathnameToDirname(topLevelPackagePathname))
    const imports = {}
    const scopes = {}

    const start = async () => {
      const topLevelPackageData = await readPackageData({
        path: pathnameToOperatingSystemPath(topLevelPackagePathname),
      })
      await visit({
        packagePathname: topLevelPackagePathname,
        packageData: topLevelPackageData,
      })
      const nodeModuleImportMap = { imports, scopes }
      const importMap = mergeTwoImportMap(inputImportMap, nodeModuleImportMap)
      const sortedImportMap = sortImportMap(importMap)

      if (writeImportMapFile) {
        const importMapPath = pathnameToOperatingSystemPath(
          `${projectPathname}${importMapRelativePath}`,
        )
        await fileWrite(importMapPath, JSON.stringify(sortedImportMap, null, "  "))
        if (logImportMapFilePath) {
          console.log(`-> ${importMapPath}`)
        }
      }
      if (writeJsconfigFile) {
        const jsConfigPath = pathnameToOperatingSystemPath(`${projectPathname}/jsconfig.json`)
        try {
          const jsConfig = {
            compilerOptions: {
              baseUrl: ".",
              paths: {
                "/*": ["./*"],
                ...importMapToVsCodeConfigPaths(importMap),
              },
            },
          }
          await fileWrite(jsConfigPath, JSON.stringify(jsConfig, null, "  "))
          if (logJsConfigFilePath) {
            console.log(`-> ${jsConfigPath}`)
          }
        } catch (e) {
          if (e.code !== "ENOENT") {
            throw e
          }
        }
      }

      return sortedImportMap
    }

    const seen = {}
    const visit = async ({ packagePathname, packageData }) => {
      if (packagePathname in seen) return
      seen[packagePathname] = true

      const isTopLevel = packagePathname === topLevelPackagePathname

      const importerName = isTopLevel
        ? topLevelImporterName
        : pathnameToDirname(pathnameToRelativePathname(packagePathname, projectPathname)).slice(1)
      const { dependencies = {}, peerDependencies = {}, devDependencies = {} } = packageData

      const arrayOfDependencyToRemap = Object.keys({
        ...dependencies,
        ...peerDependencies,
        ...(remapDevDependencies && isTopLevel ? devDependencies : {}),
      }).filter((dependencyName) =>
        remapPredicate({
          importerName,
          isTopLevel,
          dependencyName,
          isDev: dependencyName in devDependencies,
          isPeer: dependencyName in peerDependencies,
          packageData,
        }),
      )

      await Promise.all(
        arrayOfDependencyToRemap.map(async (dependencyName) => {
          const dependency = await findDependency({
            importerPathname: packagePathname,
            nodeModuleName: dependencyName,
          })
          if (!dependency) {
            throw new Error(
              createNodeModuleNotFoundMessage({
                projectPath,
                importerPath: pathnameToOperatingSystemPath(packagePathname),
                nodeModuleName: dependencyName,
              }),
            )
          }

          const {
            packagePathname: dependencyPackagePathname,
            packageData: dependencyPackageData,
          } = dependency

          const dependencyActualPathname = pathnameToDirname(dependencyPackagePathname)
          const dependencyActualRelativePath = pathnameToRelativePathname(
            dependencyActualPathname,
            projectPathname,
          )
          const dependencyExpectedPathname = `${pathnameToDirname(
            packagePathname,
          )}/node_modules/${dependencyName}`
          const dependencyExpectedRelativePath = pathnameToRelativePathname(
            dependencyExpectedPathname,
            projectPathname,
          )
          const moved = dependencyActualRelativePath !== dependencyExpectedRelativePath

          if (remapFolder) {
            const from = `${dependencyName}/`
            const to = `${dependencyActualRelativePath}/`

            addMapping({ importerName, from, to })
            if (moved) {
              addScopedImportMapping({ scope: `/${importerName}/`, from, to })
              addScopedImportMapping({
                scope: `${dependencyActualRelativePath}/`,
                from: `${dependencyActualRelativePath}/`,
                to: `${dependencyActualRelativePath}/`,
              })
            }
          }

          if (remapMain) {
            const dependencyMain = await resolvePackageMain(
              dependencyPackageData,
              dependencyPackagePathname,
            )
            const from = dependencyName
            const to = `${dependencyActualRelativePath}/${dependencyMain}`

            addMapping({ importerName, from, to })
            if (moved) {
              addScopedImportMapping({ scope: `/${importerName}/`, from, to })
            }
          }

          if (scopeOriginRelativePerModule) {
            addScopedImportMapping({
              scope: `${dependencyActualRelativePath}/`,
              from: `/`,
              to: `${dependencyActualRelativePath}/`,
            })
            addScopedImportMapping({
              scope: `${dependencyActualRelativePath}/`,
              from: `${dependencyActualRelativePath}/`,
              to: `${dependencyActualRelativePath}/`,
            })

            if (moved) {
              addScopedImportMapping({
                scope: `/${importerName}/`,
                from: `${dependencyExpectedRelativePath}/`,
                to: `${dependencyActualRelativePath}/`,
              })
              addScopedImportMapping({
                scope: `/${importerName}/`,
                from: `${dependencyActualRelativePath}/`,
                to: `${dependencyActualRelativePath}/`,
              })
            } else {
              addScopedImportMapping({
                scope: `${dependencyExpectedRelativePath}/`,
                from: `/`,
                to: `${dependencyActualRelativePath}/`,
              })
              addScopedImportMapping({
                scope: `${dependencyExpectedRelativePath}/`,
                from: `${dependencyExpectedRelativePath}/`,
                to: `${dependencyActualRelativePath}/`,
              })
            }
          }

          return visit({
            packagePathname: dependencyPackagePathname,
            packageData: dependencyPackageData,
          })
        }),
      )
    }

    const addImportMapping = ({ from, to }) => {
      imports[from] = to
    }

    const addScopedImportMapping = ({ scope, from, to }) => {
      scopes[scope] = {
        ...(scopes[scope] || {}),
        [from]: to,
      }
    }

    const addMapping = ({ importerName, from, to }) => {
      if (importerName === topLevelImporterName) {
        addImportMapping({ from, to })
      } else {
        addScopedImportMapping({ scope: `/${importerName}/`, from, to })
      }
    }

    const dependenciesCache = {}
    const findDependency = ({ importerPathname, nodeModuleName }) => {
      if (importerPathname in dependenciesCache === false) {
        dependenciesCache[importerPathname] = {}
      }
      if (nodeModuleName in dependenciesCache[importerPathname]) {
        return dependenciesCache[importerPathname][nodeModuleName]
      }

      const dependencyPromise = resolveNodeModule({
        rootPathname: projectPathname,
        importerPathname,
        nodeModuleName,
      })
      dependenciesCache[importerPathname][nodeModuleName] = dependencyPromise
      return dependencyPromise
    }

    const promise = start()
    if (!throwUnhandled) return promise
    return promise.catch((e) => {
      setTimeout(() => {
        throw e
      })
    })
  })

const createNodeModuleNotFoundMessage = ({
  projectPath,
  importerPath,
  nodeModuleName,
}) => `node module not found.
node module name: ${nodeModuleName}
importer path: ${importerPath}
project path : ${projectPath}`
