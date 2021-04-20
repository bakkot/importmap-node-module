// https://nodejs.org/dist/latest-v13.x/docs/api/esm.html#esm_package_exports

import { urlToFileSystemPath, urlToRelativeUrl, resolveUrl } from "@jsenv/util"
import { specifierIsRelative } from "./specifierIsRelative.js"

export const visitPackageExports = ({
  packageFileUrl,
  packageJsonObject,
  packageExports = packageJsonObject.exports,
  packageName = packageJsonObject.name,
  projectDirectoryUrl,
  packageConditions,
  warn,
}) => {
  const exportsSubpaths = {}
  const packageDirectoryUrl = resolveUrl("./", packageFileUrl)
  const packageDirectoryRelativeUrl = urlToRelativeUrl(packageDirectoryUrl, projectDirectoryUrl)
  const onExportsSubpath = ({ key, value, trace }) => {
    if (!specifierIsRelative(key)) {
      warn(
        createExportsSubpathKeyMustBeRelativeWarning({
          key,
          keyTrace: trace.slice(0, -1),
          packageFileUrl,
        }),
      )
      return
    }
    if (typeof value !== "string") {
      warn(
        createExportsSubpathValueMustBeAStringWarning({
          value,
          valueTrace: trace,
          packageFileUrl,
        }),
      )
      return
    }
    if (!specifierIsRelative(value)) {
      warn(
        createExportsSubpathValueMustBeRelativeWarning({
          value,
          valueTrace: trace,
          packageFileUrl,
        }),
      )
      return
    }

    const keyNormalized = specifierToSource(key, packageName)
    const valueNormalized = addressToDestination(value, packageDirectoryRelativeUrl)
    exportsSubpaths[keyNormalized] = valueNormalized
  }

  const conditions = [...packageConditions, "default"]

  const visitSubpathValue = (subpathValue, subpathValueTrace) => {
    // false is allowed as alternative to exports: {}
    if (subpathValue === false) {
      return handleFalse()
    }

    if (typeof subpathValue === "string") {
      return handleString(subpathValue, subpathValueTrace)
    }

    if (typeof subpathValue === "object" && subpathValue !== null) {
      return handleObject(subpathValue, subpathValueTrace)
    }

    return handleRemaining(subpathValue, subpathValueTrace)
  }

  const handleFalse = () => {
    // nothing to do
    return true
  }

  const handleString = (subpathValue, subpathValueTrace) => {
    const firstNonConditionKey = subpathValueTrace
      .slice()
      .reverse()
      .find((key) => key.startsWith("."))
    const key = firstNonConditionKey || "."
    onExportsSubpath({
      key,
      value: subpathValue,
      trace: subpathValueTrace,
    })
    return true
  }

  const handleObject = (subpathValue, subpathValueTrace) => {
    // From Node.js documentation:
    // "If a nested conditional does not have any mapping it will continue
    // checking the remaining conditions of the parent condition"
    // https://nodejs.org/docs/latest-v14.x/api/packages.html#packages_nested_conditions
    //
    // So it seems what we do here is not sufficient
    // -> if the condition finally does not lead to something
    // it should be ignored and an other branch be taken until
    // something resolves
    const followConditionBranch = (subpathValue, conditionTrace) => {
      const relativeKeys = []
      const conditionalKeys = []
      Object.keys(subpathValue).forEach((availableKey) => {
        if (availableKey.startsWith(".")) {
          relativeKeys.push(availableKey)
        } else {
          conditionalKeys.push(availableKey)
        }
      })

      if (relativeKeys.length > 0 && conditionalKeys.length > 0) {
        // see https://nodejs.org/dist/latest-v13.x/docs/api/esm.html#esm_exports_sugar
        warn(
          createUnexpectedExportsSubpathWarning({
            subpathValue,
            subpathValueTrace: [...subpathValueTrace, ...conditionTrace],
            packageFileUrl,
            relativeKeys,
            conditionalKeys,
          }),
        )
        return false
      }

      // there is no condition, visit all relative keys
      if (conditionalKeys.length === 0) {
        let someExportAdded = false
        relativeKeys.forEach((key) => {
          someExportAdded = visitSubpathValue(subpathValue[key], [
            ...subpathValueTrace,
            ...conditionTrace,
            key,
          ])
        })
        return someExportAdded
      }

      // there is a condition, keep the first one leading to something
      return conditions.some((keyCandidate) => {
        if (!conditionalKeys.includes(keyCandidate)) {
          return false
        }
        const valueCandidate = subpathValue[keyCandidate]
        return visitSubpathValue(valueCandidate, [
          ...subpathValueTrace,
          ...conditionTrace,
          keyCandidate,
        ])
      })
    }

    return followConditionBranch(subpathValue, [])
  }

  const handleRemaining = (subpathValue, subpathValueTrace) => {
    warn(
      createMixedExportsSubpathWarning({
        subpathValue,
        subpathValueTrace,
        packageFileUrl,
      }),
    )
    return false
  }

  visitSubpathValue(packageExports, ["exports"])

  return exportsSubpaths
}

const specifierToSource = (specifier, packageName) => {
  if (specifier === ".") {
    return packageName
  }

  if (specifier[0] === "/") {
    return specifier
  }

  if (specifier.startsWith("./")) {
    return `${packageName}${specifier.slice(1)}`
  }

  return `${packageName}/${specifier}`
}

const addressToDestination = (address, packageDirectoryRelativeUrl) => {
  if (address[0] === "/") {
    return address
  }

  if (address.startsWith("./")) {
    return `./${packageDirectoryRelativeUrl}${address.slice(2)}`
  }

  return `./${packageDirectoryRelativeUrl}${address}`
}

const createUnexpectedExportsSubpathWarning = ({
  subpathValue,
  subpathValueTrace,
  packageFileUrl,
}) => {
  return {
    code: "EXPORTS_SUBPATH_UNEXPECTED",
    message: `unexpected value in package.json exports: value must be an object or a string.
--- value ---
${subpathValue}
--- value at ---
${subpathValueTrace.join(".")}
--- package.json path ---
${urlToFileSystemPath(packageFileUrl)}`,
  }
}

const createMixedExportsSubpathWarning = ({ subpathValue, subpathValueTrace, packageFileUrl }) => {
  return {
    code: "EXPORTS_SUBPATH_MIXED",
    message: `unexpected value in package.json exports: cannot mix conditional and subpath.
--- value ---
${JSON.stringify(subpathValue, null, "  ")}
--- value at ---
${subpathValueTrace.join(".")}
--- package.json path ---
${urlToFileSystemPath(packageFileUrl)}`,
  }
}

const createExportsSubpathKeyMustBeRelativeWarning = ({ key, keyTrace, packageFileUrl }) => {
  return {
    code: "EXPORTS_SUBPATH_KEY_MUST_BE_RELATIVE",
    message: `unexpected key in package.json exports: key must be relative.
--- key ---
${key}
--- key at ---
${keyTrace.join(".")}
--- package.json path ---
${urlToFileSystemPath(packageFileUrl)}`,
  }
}

const createExportsSubpathValueMustBeAStringWarning = ({ value, valueTrace, packageFileUrl }) => {
  return {
    code: "EXPORTS_SUBPATH_VALUE_MUST_BE_A_STRING",
    message: `unexpected value in package.json exports: value must be a string.
--- value ---
${value}
--- value at ---
${valueTrace.join(".")}
--- package.json path ---
${urlToFileSystemPath(packageFileUrl)}`,
  }
}

const createExportsSubpathValueMustBeRelativeWarning = ({ value, valueTrace, packageFileUrl }) => {
  return {
    code: "EXPORTS_SUBPATH_VALUE_MUST_BE_RELATIVE",
    message: `unexpected value in package.json exports: value must be relative.
--- value ---
${value}
--- value at ---
${valueTrace.join(".")}
--- package.json path ---
${urlToFileSystemPath(packageFileUrl)}`,
  }
}
