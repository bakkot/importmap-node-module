import { basename } from "path"
import {
  operatingSystemPathToPathname,
  pathnameToRelativePathname,
  pathnameToOperatingSystemPath,
} from "@jsenv/operating-system-path"
import { pathnameToDirname } from "@jsenv/module-resolution"
import { fileWrite } from "@dmail/helper"
import { catchAsyncFunctionCancellation } from "@dmail/cancellation"
import { mergeTwoImportMap } from "../mergeTwoImportMap/mergeTwoImportMap.js"
import {
  resolveNodeModule,
  readPackageData,
  resolvePackageMain,
} from "./node-module-resolution/index.js"
import { sortImportMap } from "./sortImportMap.js"
import { importMapToVsCodeConfigPaths } from "./importMapToVsCodeConfigPaths.js"

export const generateImportMapForNodeModules = async ({
  projectPath,
  rootProjectPath = projectPath,
  importMapRelativePath = "/importMap.json",
  inputImportMap = {},
  remapDevDependencies = true,
  onWarn = ({ message }) => {
    console.warn(message)
  },
  writeImportMapFile = false,
  logImportMapFilePath = true,
  throwUnhandled = true,
  writeJsConfigFile = false,
  logJsConfigFilePath = true,
}) =>
  catchAsyncFunctionCancellation(async () => {
    const projectPathname = operatingSystemPathToPathname(projectPath)
    const projectPackagePathname = `${projectPathname}/package.json`

    const rootProjectPathname = operatingSystemPathToPathname(rootProjectPath)
    const rootImporterName = basename(rootProjectPathname)
    const rootPackagePathname = `${rootProjectPathname}/package.json`

    const imports = {}
    const scopes = {}

    const start = async () => {
      const projectPackageData = await readPackageData({
        path: pathnameToOperatingSystemPath(projectPackagePathname),
        onWarn,
      })
      await visitProjectPackage({
        packagePathname: projectPackagePathname,
        packageData: projectPackageData,
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
      if (writeJsConfigFile) {
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

    const visitProjectPackage = async ({ packagePathname, packageData }) => {
      await visit({
        packagePathname,
        packageData,
        packageName: packageData.name,
        importerPackagePathname: packagePathname,
      })
    }

    const seen = {}
    const visit = async ({
      packagePathname,
      packageData,
      packageName,
      importerPackagePathname,
    }) => {
      if (packagePathname in seen) {
        if (seen[packagePathname].includes(importerPackagePathname)) return
        seen[packagePathname].push(importerPackagePathname)
      } else {
        seen[packagePathname] = [importerPackagePathname]
      }

      const isRootPackage = packagePathname === rootPackagePathname
      if (isRootPackage) {
        await visitRootPackage()
      } else {
        await visitNonRootPackage({
          packagePathname,
          packageData,
          packageName,
          importerPackagePathname,
        })
      }
      await visitDependencies({
        packagePathname,
        packageData,
      })
    }

    const visitRootPackage = async () => {
      // TODO: take into acount `imports` only
    }

    const visitNonRootPackage = async ({
      packagePathname,
      packageData,
      packageName,
      importerPackagePathname,
    }) => {
      const importerName =
        importerPackagePathname === rootPackagePathname
          ? rootImporterName
          : pathnameToDirname(
              pathnameToRelativePathname(importerPackagePathname, rootProjectPathname),
            ).slice(1)
      const actualPathname = pathnameToDirname(packagePathname)
      const actualRelativePath = pathnameToRelativePathname(actualPathname, rootProjectPathname)
      const expectedPathname = `${pathnameToDirname(
        importerPackagePathname,
      )}/node_modules/${packageName}`
      const expectedRelativePath = pathnameToRelativePathname(expectedPathname, rootProjectPathname)
      const main = await resolvePackageMain({
        packageData,
        packagePathname,
        onWarn: () => {},
      })

      if (main) {
        const from = packageName
        const to = `${actualRelativePath}/${main}`

        addMapping({ importerName, from, to })
        if (actualRelativePath !== expectedRelativePath) {
          addScopedImportMapping({ scope: `/${importerName}/`, from, to })
        }
      }

      if ("imports" in packageData) {
        visitPackageImports({
          packageData,
          packagePathname,
          packageName,
          importerName,
          actualRelativePath,
          expectedRelativePath,
        })
      }

      if ("exports" in packageData) {
        visitPackageExports({
          packageData,
          packagePathname,
          packageName,
          importerName,
          actualRelativePath,
          expectedRelativePath,
        })
      }
    }

    const visitPackageImports = ({
      packageData,
      packagePathname,
      packageName,
      importerName,
      actualRelativePath,
      expectedRelativePath,
    }) => {
      const { imports: packageImports } = packageData
      if (typeof packageImports !== "object" || packageImports === null) {
        onWarn(
          createUnexpectedPackageImportsWarning({
            packageImports,
            packagePathname,
          }),
        )
        return
      }

      // ensure imports remains scoped to the package
      addScopedImportMapping({
        scope: `${actualRelativePath}/`,
        from: `${actualRelativePath}/`,
        to: `${actualRelativePath}/`,
      })
      if (actualRelativePath === expectedRelativePath) {
        addScopedImportMapping({
          scope: `${expectedRelativePath}/`,
          from: `${expectedRelativePath}/`,
          to: `${actualRelativePath}/`,
        })
      } else {
        addScopedImportMapping({
          scope: `/${importerName}/`,
          from: `${expectedRelativePath}/`,
          to: `${actualRelativePath}/`,
        })
        addScopedImportMapping({
          scope: `/${importerName}/`,
          from: `${actualRelativePath}/`,
          to: `${actualRelativePath}/`,
        })
      }

      Object.keys(packageImports).forEach((key) => {
        const resolvedKey = resolvePathInPackage(key, packagePathname)
        if (!resolvedKey) return
        const resolvedValue = resolvePathInPackage(packageImports[key], packagePathname)
        if (!resolvedValue) return
        const from = resolvedKey
        const to = `${actualRelativePath}${resolvedValue}`

        addScopedImportMapping({
          scope: `${actualRelativePath}/`,
          from,
          to,
        })
      })
    }

    const visitPackageExports = ({
      packageData,
      packagePathname,
      packageName,
      importerName,
      actualRelativePath,
      expectedRelativePath,
    }) => {
      const { exports: packageExports } = packageData
      if (typeof packageExports !== "object" || packageExports === null) {
        onWarn(
          createUnexpectedPackageExportsWarning({
            packageExports,
            packagePathname,
          }),
        )
        return
      }

      Object.keys(packageExports).forEach((key) => {
        const resolvedKey = resolvePathInPackage(key, packagePathname)
        if (!resolvedKey) return
        const resolvedValue = resolvePathInPackage(packageExports[key], packagePathname)
        if (!resolvedValue) return
        const from = `${packageName}${resolvedKey}`
        const to = `${actualRelativePath}${resolvedValue}`

        addMapping({
          importerName,
          from,
          to,
        })
        if (actualRelativePath !== expectedRelativePath) {
          addScopedImportMapping({
            scope: `/${importerName}/`,
            from,
            to,
          })
        }
      })
    }

    const visitDependencies = async ({ packagePathname, packageData }) => {
      const dependencyMap = {}

      const { dependencies = {} } = packageData
      Object.keys(dependencies).forEach((dependencyName) => {
        dependencyMap[dependencyName] = {
          type: "dependency",
          versionPattern: dependencies[dependencyName],
        }
      })

      const { peerDependencies = {} } = packageData
      Object.keys(peerDependencies).forEach((dependencyName) => {
        dependencyMap[dependencyName] = {
          type: "peerDependency",
          versionPattern: peerDependencies[dependencyName],
        }
      })

      const isProjectPackage = packagePathname === projectPackagePathname
      if (remapDevDependencies && isProjectPackage) {
        const { devDependencies = {} } = packageData
        Object.keys(devDependencies).forEach((dependencyName) => {
          if (!dependencyMap.hasOwnProperty(dependencyName)) {
            dependencyMap[dependencyName] = {
              type: "devDependency",
              versionPattern: devDependencies[dependencyName],
            }
          }
        })
      }

      await Promise.all(
        Object.keys(dependencyMap).map(async (dependencyName) => {
          const dependency = dependencyMap[dependencyName]
          const dependencyData = await findDependency({
            packagePathname,
            packageData,
            dependencyName,
            dependencyType: dependency.type,
            dependencyVersionPattern: dependency.versionPattern,
          })
          if (!dependencyData) {
            return
          }

          const {
            packagePathname: dependencyPackagePathname,
            packageData: dependencyPackageData,
          } = dependencyData

          await visit({
            packagePathname: dependencyPackagePathname,
            packageData: dependencyPackageData,
            packageName: dependencyName,
            importerPackagePathname: packagePathname,
          })
        }),
      )
    }

    const resolvePathInPackage = (path, packagePathname) => {
      if (path[0] === "/") return path
      if (path.slice(0, 2) === "./") return path.slice(1)
      onWarn(
        createInvalidPackageRelativePathWarning({
          path,
          packagePathname,
        }),
      )
      return ""
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
      if (importerName === rootImporterName) {
        addImportMapping({ from, to })
      } else {
        addScopedImportMapping({ scope: `/${importerName}/`, from, to })
      }
    }

    const dependenciesCache = {}
    const findDependency = ({
      packagePathname,
      packageData,
      dependencyName,
      dependencyType,
      dependencyVersionPattern,
    }) => {
      if (packagePathname in dependenciesCache === false) {
        dependenciesCache[packagePathname] = {}
      }
      if (dependencyName in dependenciesCache[packagePathname]) {
        return dependenciesCache[packagePathname][dependencyName]
      }
      const dependencyPromise = resolveNodeModule({
        rootPathname: rootProjectPathname,
        packagePathname,
        packageData,
        dependencyName,
        dependencyType,
        dependencyVersionPattern,
        onWarn,
      })
      dependenciesCache[packagePathname][dependencyName] = dependencyPromise
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

const createInvalidPackageRelativePathWarning = ({ path, packagePathname }) => {
  return {
    code: "INVALID_PATH_RELATIVE_TO_PACKAGE",
    message: `
invalid path relative to package.
--- path ---
${path}
--- package.json path ---
${pathnameToOperatingSystemPath(packagePathname)}
`,
    data: { packagePathname, path },
  }
}

const createUnexpectedPackageImportsWarning = ({ packageImports, packagePathname }) => {
  return {
    code: "UNEXPECTED_PACKAGE_IMPORTS",
    message: `
package.imports must be an object.
--- package.json imports ---
${packageImports}
--- package.json path ---
${pathnameToOperatingSystemPath(packagePathname)}
`,
    data: { packagePathname, packageImports },
  }
}

const createUnexpectedPackageExportsWarning = ({ packageExports, packagePathname }) => {
  return {
    code: "UNEXPECTED_PACKAGE_EXPORTS",
    message: `
package.exports must be an object.
--- package.json exports ---
${packageExports}
--- package.json path ---
${pathnameToOperatingSystemPath(packagePathname)}
`,
    data: { packagePathname, packageExports },
  }
}
