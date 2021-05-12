'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var importMap = require('@jsenv/import-map');
var logger = require('@jsenv/logger');
var util = require('@jsenv/util');
var isSpecifierForNodeCoreModule_js = require('@jsenv/import-map/src/isSpecifierForNodeCoreModule.js');
var module$1 = require('module');
var cancellation = require('@jsenv/cancellation');

const memoizeAsyncFunctionByUrl = fn => {
  const cache = {};
  return memoizeAsyncFunction(fn, {
    getMemoryEntryFromArguments: ([url]) => {
      return {
        get: () => {
          return cache[url];
        },
        set: promise => {
          cache[url] = promise;
        },
        delete: () => {
          delete cache[url];
        }
      };
    }
  });
};
const memoizeAsyncFunctionBySpecifierAndImporter = fn => {
  const importerCache = {};
  return memoizeAsyncFunction(fn, {
    getMemoryEntryFromArguments: ([specifier, importer]) => {
      return {
        get: () => {
          const specifierCacheForImporter = importerCache[importer];
          return specifierCacheForImporter ? specifierCacheForImporter[specifier] : null;
        },
        set: promise => {
          const specifierCacheForImporter = importerCache[importer];

          if (specifierCacheForImporter) {
            specifierCacheForImporter[specifier] = promise;
          } else {
            importerCache[importer] = {
              [specifier]: promise
            };
          }
        },
        delete: () => {
          const specifierCacheForImporter = importerCache[importer];

          if (specifierCacheForImporter) {
            delete specifierCacheForImporter[specifier];
          }
        }
      };
    }
  });
};

const memoizeAsyncFunction = (fn, {
  getMemoryEntryFromArguments
}) => {
  const memoized = async (...args) => {
    const memoryEntry = getMemoryEntryFromArguments(args);
    const promiseFromMemory = memoryEntry.get();

    if (promiseFromMemory) {
      return promiseFromMemory;
    }

    const {
      promise,
      resolve,
      reject
    } = createControllablePromise();
    memoryEntry.set(promise);
    let value;
    let error;

    try {
      value = fn(...args);
      error = false;
    } catch (e) {
      value = e;
      error = true;
      memoryEntry.delete();
    }

    if (error) {
      reject(error);
    } else {
      resolve(value);
    }

    return promise;
  };

  memoized.isInMemory = (...args) => {
    return Boolean(getMemoryEntryFromArguments(args).get());
  };

  return memoized;
};

const createControllablePromise = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve,
    reject
  };
};

/* global __filename */
const filenameContainsBackSlashes = __filename.indexOf("\\") > -1;
const url = filenameContainsBackSlashes ? `file:///${__filename.replace(/\\/g, "/")}` : `file://${__filename}`;

const require$1 = module$1.createRequire(url);

const parser = require$1("@babel/parser");

const traverse = require$1("@babel/traverse");

const parseSpecifiersFromFile = async (fileUrl, {
  fileContent,
  sourceType = "module",
  allowImportExportEverywhere = true,
  allowAwaitOutsideFunction = true,
  ranges = true,
  jsx = true,
  typescript = fileUrl.endsWith(".ts") || fileUrl.endsWith(".tsx"),
  flow = false,
  ...options
} = {}) => {
  fileContent = fileContent === undefined ? await util.readFile(fileUrl, {
    as: "string"
  }) : fileContent;
  const ast = parser.parse(fileContent, {
    sourceType,
    sourceFilename: util.urlToFileSystemPath(fileUrl),
    allowImportExportEverywhere,
    allowAwaitOutsideFunction,
    ranges,
    plugins: [// "estree",
    "topLevelAwait", "exportDefaultFrom", ...(jsx ? ["jsx"] : []), ...(typescript ? ["typescript"] : []), ...(flow ? ["flow"] : [])],
    ...options
  });
  const specifiers = {};

  const addSpecifier = ({
    path,
    type
  }) => {
    const specifier = path.node.value;
    specifiers[specifier] = {
      line: path.node.loc.start.line,
      column: path.node.loc.start.column,
      type
    };
  };

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
    CallExpression: path => {
      if (path.node.callee.type !== "Import") {
        // Some other function call, not import();
        return;
      }

      if (path.node.arguments[0].type !== "StringLiteral") {
        // Non-string argument, probably a variable or expression, e.g.
        // import(moduleId)
        // import('./' + moduleName)
        return;
      }

      addSpecifier({
        path: path.get("arguments")[0],
        type: "import-dynamic"
      });
    },
    ExportAllDeclaration: path => {
      addSpecifier({
        path: path.get("source"),
        type: "export-all"
      });
    },
    ExportNamedDeclaration: path => {
      if (!path.node.source) {
        // This export has no "source", so it's probably
        // a local variable or function, e.g.
        // export { varName }
        // export const constName = ...
        // export function funcName() {}
        return;
      }

      addSpecifier({
        path: path.get("source"),
        type: "export-named"
      });
    },
    ImportDeclaration: path => {
      addSpecifier({
        path: path.get("source"),
        type: "import-static"
      });
    }
  });
  return specifiers;
};

// https://github.com/postcss/postcss/blob/fd30d3df5abc0954a0ec642a3cdc644ab2aacf9c/lib/css-syntax-error.js#L43
// https://github.com/postcss/postcss/blob/fd30d3df5abc0954a0ec642a3cdc644ab2aacf9c/lib/terminal-highlight.js#L50
// https://github.com/babel/babel/blob/eea156b2cb8deecfcf82d52aa1b71ba4995c7d68/packages/babel-code-frame/src/index.js#L1
const showSource = ({
  url,
  line,
  column,
  source
}) => {
  let message = "";
  message += typeof url === "undefined" ? "Anonymous" : url;

  if (typeof line !== "number") {
    return message;
  }

  message += `:${line}`;

  if (typeof column === "number") {
    message += `:${column}`;
  }

  if (!source) {
    return message;
  }

  return `${message}
${showSourceLocation(source, {
    line,
    column
  })}`;
};
const red = "\x1b[31m";
const grey = "\x1b[39m";
const ansiResetSequence = "\x1b[0m";

const showSourceLocation = (source, {
  line,
  column,
  numberOfSurroundingLinesToShow = 1,
  lineMaxLength = 120,
  color = false,
  markColor = red,
  asideColor = grey,
  colorMark = string => `${markColor}${string}${ansiResetSequence}`,
  colorAside = string => `${asideColor}${string}${ansiResetSequence}`
}) => {
  const mark = color ? colorMark : string => string;
  const aside = color ? colorAside : string => string;
  const lines = source.split(/\r?\n/);
  let lineRange = {
    start: line - 1,
    end: line
  };
  lineRange = moveLineRangeUp(lineRange, numberOfSurroundingLinesToShow);
  lineRange = moveLineRangeDown(lineRange, numberOfSurroundingLinesToShow);
  lineRange = lineRangeWithinLines(lineRange, lines);
  const linesToShow = lines.slice(lineRange.start, lineRange.end);
  const endLineNumber = lineRange.end;
  const lineNumberMaxWidth = String(endLineNumber).length;
  const columnRange = {};

  if (column === undefined) {
    columnRange.start = 0;
    columnRange.end = lineMaxLength;
  } else if (column > lineMaxLength) {
    columnRange.start = column - Math.floor(lineMaxLength / 2);
    columnRange.end = column + Math.ceil(lineMaxLength / 2);
  } else {
    columnRange.start = 0;
    columnRange.end = lineMaxLength;
  }

  return linesToShow.map((lineSource, index) => {
    const lineNumber = lineRange.start + index + 1;
    const isMainLine = lineNumber === line;
    const lineSourceTruncated = applyColumnRange(columnRange, lineSource);
    const lineNumberWidth = String(lineNumber).length; // ensure if line moves from 7,8,9 to 10 the display is still great

    const lineNumberRightSpacing = " ".repeat(lineNumberMaxWidth - lineNumberWidth);
    const asideSource = `${lineNumber}${lineNumberRightSpacing} |`;
    const lineFormatted = `${aside(asideSource)} ${lineSourceTruncated}`;

    if (isMainLine) {
      if (column === undefined) {
        return `${mark(">")} ${lineFormatted}`;
      }

      const lineSourceUntilColumn = lineSourceTruncated.slice(0, column - columnRange.start);
      const spacing = stringToSpaces(lineSourceUntilColumn);
      const mainLineFormatted = `${mark(">")} ${lineFormatted}
  ${" ".repeat(lineNumberWidth)} ${aside("|")}${spacing}${mark("^")}`;
      return mainLineFormatted;
    }

    return `  ${lineFormatted}`;
  }).join(`
`);
};

const applyColumnRange = ({
  start,
  end
}, line) => {
  if (typeof start !== "number") {
    throw new TypeError(`start must be a number, received ${start}`);
  }

  if (typeof end !== "number") {
    throw new TypeError(`end must be a number, received ${end}`);
  }

  if (end < start) {
    throw new Error(`end must be greater than start, but ${end} is smaller than ${start}`);
  }

  const prefix = "…";
  const suffix = "…";
  const lastIndex = line.length;

  if (line.length === 0) {
    // don't show any ellipsis if the line is empty
    // because it's not truncated in that case
    return "";
  }

  const startTruncated = start > 0;
  const endTruncated = lastIndex > end;
  let from = startTruncated ? start + prefix.length : start;
  let to = endTruncated ? end - suffix.length : end;
  if (to > lastIndex) to = lastIndex;

  if (start >= lastIndex || from === to) {
    return "";
  }

  let result = "";

  while (from < to) {
    result += line[from];
    from++;
  }

  if (result.length === 0) {
    return "";
  }

  if (startTruncated && endTruncated) {
    return `${prefix}${result}${suffix}`;
  }

  if (startTruncated) {
    return `${prefix}${result}`;
  }

  if (endTruncated) {
    return `${result}${suffix}`;
  }

  return result;
};

const stringToSpaces = string => string.replace(/[^\t]/g, " "); // const getLineRangeLength = ({ start, end }) => end - start


const moveLineRangeUp = ({
  start,
  end
}, number) => {
  return {
    start: start - number,
    end
  };
};

const moveLineRangeDown = ({
  start,
  end
}, number) => {
  return {
    start,
    end: end + number
  };
};

const lineRangeWithinLines = ({
  start,
  end
}, lines) => {
  return {
    start: start < 0 ? 0 : start,
    end: end > lines.length ? lines.length : end
  };
};

const resolveFile = async (fileUrl, {
  magicExtensions
}) => {
  const fileStat = await util.readFileSystemNodeStat(fileUrl, {
    nullIfNotFound: true
  }); // file found

  if (fileStat && fileStat.isFile()) {
    return fileUrl;
  } // directory found


  if (fileStat && fileStat.isDirectory()) {
    const indexFileSuffix = fileUrl.endsWith("/") ? "index" : "/index";
    const indexFileUrl = `${fileUrl}${indexFileSuffix}`;
    const extensionLeadingToAFile = await findExtensionLeadingToFile(indexFileUrl, magicExtensions);

    if (extensionLeadingToAFile === null) {
      return null;
    }

    return `${indexFileUrl}${extensionLeadingToAFile}`;
  } // file not found and it has an extension


  const extension = util.urlToExtension(fileUrl);

  if (extension !== "") {
    return null;
  }

  const extensionLeadingToAFile = await findExtensionLeadingToFile(fileUrl, magicExtensions); // magic extension not found

  if (extensionLeadingToAFile === null) {
    return null;
  } // magic extension worked


  return `${fileUrl}${extensionLeadingToAFile}`;
};

const findExtensionLeadingToFile = async (fileUrl, magicExtensions) => {
  const urlDirectoryUrl = util.resolveUrl("./", fileUrl);
  const urlFilename = util.urlToFilename(fileUrl);
  const extensionLeadingToFile = await cancellation.firstOperationMatching({
    array: magicExtensions,
    start: async extensionCandidate => {
      const urlCandidate = `${urlDirectoryUrl}${urlFilename}${extensionCandidate}`;
      const stats = await util.readFileSystemNodeStat(urlCandidate, {
        nullIfNotFound: true
      });
      return stats && stats.isFile() ? extensionCandidate : null;
    },
    predicate: extension => Boolean(extension)
  });
  return extensionLeadingToFile || null;
};

const BARE_SPECIFIER_ERROR = {};
const getImportMapFromJsFiles = async ({
  warn,
  projectDirectoryUrl,
  importMap: importMap$1,
  magicExtensions,
  runtime,
  treeshakeMappings
}) => {
  const projectPackageFileUrl = util.resolveUrl("./package.json", projectDirectoryUrl);
  const imports = {};
  const scopes = {};

  const addMapping = ({
    scope,
    from,
    to
  }) => {
    if (scope) {
      scopes[scope] = { ...(scopes[scope] || {}),
        [from]: to
      };
    } else {
      imports[from] = to;
    }
  };

  const topLevelMappingsUsed = [];
  const scopedMappingsUsed = {};

  const markMappingAsUsed = ({
    scope,
    from,
    to
  }) => {
    if (scope) {
      if (scope in scopedMappingsUsed) {
        scopedMappingsUsed[scope].push({
          from,
          to
        });
      } else {
        scopedMappingsUsed[scope] = [{
          from,
          to
        }];
      }
    } else {
      topLevelMappingsUsed.push({
        from,
        to
      });
    }
  };

  const importMapNormalized = importMap.normalizeImportMap(importMap$1, projectDirectoryUrl);

  const trackAndResolveImport = (specifier, importer) => {
    return importMap.resolveImport({
      specifier,
      importer,
      importMap: importMapNormalized,
      defaultExtension: false,
      onImportMapping: ({
        scope,
        from
      }) => {
        if (scope) {
          // make scope relative again
          scope = `./${util.urlToRelativeUrl(scope, projectDirectoryUrl)}`; // make from relative again

          if (from.startsWith(projectDirectoryUrl)) {
            from = `./${util.urlToRelativeUrl(from, projectDirectoryUrl)}`;
          }
        }

        markMappingAsUsed({
          scope,
          from,
          to: scope ? importMap$1.scopes[scope][from] : importMap$1.imports[from]
        });
      },
      createBareSpecifierError: () => BARE_SPECIFIER_ERROR
    });
  };

  const resolveFileSystemUrl = memoizeAsyncFunctionBySpecifierAndImporter(async (specifier, importer, {
    importedBy
  }) => {
    if (runtime === "node" && isSpecifierForNodeCoreModule_js.isSpecifierForNodeCoreModule(specifier)) {
      return null;
    }

    let fileUrl;
    let gotBareSpecifierError = false;

    try {
      fileUrl = trackAndResolveImport(specifier, importer);
    } catch (e) {
      if (e !== BARE_SPECIFIER_ERROR) {
        throw e;
      }

      if (importer === projectPackageFileUrl) {
        // cannot find package main file (package.main is "" for instance)
        // we can't discover main file and parse dependencies
        return null;
      }

      gotBareSpecifierError = true;
      fileUrl = util.resolveUrl(specifier, importer);
    }

    const fileUrlOnFileSystem = await resolveFile(fileUrl, {
      magicExtensions: magicExtensionWithImporterExtension(magicExtensions, importer)
    });

    if (!fileUrlOnFileSystem) {
      warn(createFileNotFoundWarning({
        specifier,
        importedBy,
        fileUrl,
        magicExtensions
      }));
      return null;
    }

    const needsAutoMapping = fileUrlOnFileSystem !== fileUrl || gotBareSpecifierError;

    if (needsAutoMapping) {
      const packageDirectoryUrl = packageDirectoryUrlFromUrl(fileUrl, projectDirectoryUrl);
      const packageFileUrl = util.resolveUrl("package.json", packageDirectoryUrl);
      const autoMapping = {
        scope: packageFileUrl === projectPackageFileUrl ? undefined : `./${util.urlToRelativeUrl(packageDirectoryUrl, projectDirectoryUrl)}`,
        from: specifier,
        to: `./${util.urlToRelativeUrl(fileUrlOnFileSystem, projectDirectoryUrl)}`
      };
      addMapping(autoMapping);
      markMappingAsUsed(autoMapping);
      warn(formatAutoMappingSpecifierWarning({
        specifier,
        importedBy,
        autoMapping,
        closestPackageDirectoryUrl: packageDirectoryUrl,
        closestPackageObject: await util.readFile(packageFileUrl, {
          as: "json"
        })
      }));
    }

    return fileUrlOnFileSystem;
  });
  const visitFile = memoizeAsyncFunctionByUrl(async fileUrl => {
    const fileContent = await util.readFile(fileUrl, {
      as: "string"
    });
    const specifiers = await parseSpecifiersFromFile(fileUrl, {
      fileContent
    });
    const dependencies = await Promise.all(Object.keys(specifiers).map(async specifier => {
      const specifierInfo = specifiers[specifier];
      const dependencyUrlOnFileSystem = await resolveFileSystemUrl(specifier, fileUrl, {
        importedBy: showSource({
          url: fileUrl,
          line: specifierInfo.line,
          column: specifierInfo.column,
          source: fileContent
        })
      });
      return dependencyUrlOnFileSystem;
    }));
    const dependenciesToVisit = dependencies.filter(dependency => {
      return dependency && !visitFile.isInMemory(dependency);
    });
    await Promise.all(dependenciesToVisit.map(dependency => {
      return visitFile(dependency);
    }));
  });
  const projectPackageObject = await util.readFile(projectPackageFileUrl, {
    as: "json"
  });
  const projectMainFileUrlOnFileSystem = await resolveFileSystemUrl(projectPackageObject.name, projectPackageFileUrl, {
    importedBy: projectPackageObject.exports ? `${projectPackageFileUrl}#exports` : `${projectPackageFileUrl}`
  });

  if (projectMainFileUrlOnFileSystem) {
    await visitFile(projectMainFileUrlOnFileSystem);
  }

  if (treeshakeMappings) {
    const importsUsed = {};
    topLevelMappingsUsed.forEach(({
      from,
      to
    }) => {
      importsUsed[from] = to;
    });
    const scopesUsed = {};
    Object.keys(scopedMappingsUsed).forEach(scope => {
      const mappingsUsed = scopedMappingsUsed[scope];
      const scopedMappings = {};
      mappingsUsed.forEach(({
        from,
        to
      }) => {
        scopedMappings[from] = to;
      });
      scopesUsed[scope] = scopedMappings;
    });
    return importMap.sortImportMap({
      imports: importsUsed,
      scopes: scopesUsed
    });
  }

  return importMap.sortImportMap(importMap.composeTwoImportMaps(importMap$1, {
    imports,
    scopes
  }));
};

const packageDirectoryUrlFromUrl = (url, projectDirectoryUrl) => {
  const relativeUrl = util.urlToRelativeUrl(url, projectDirectoryUrl);
  const lastNodeModulesDirectoryStartIndex = relativeUrl.lastIndexOf("node_modules/");

  if (lastNodeModulesDirectoryStartIndex === -1) {
    return projectDirectoryUrl;
  }

  const lastNodeModulesDirectoryEndIndex = lastNodeModulesDirectoryStartIndex + `node_modules/`.length;
  const beforeNodeModulesLastDirectory = relativeUrl.slice(0, lastNodeModulesDirectoryEndIndex);
  const afterLastNodeModulesDirectory = relativeUrl.slice(lastNodeModulesDirectoryEndIndex);
  const remainingDirectories = afterLastNodeModulesDirectory.split("/");

  if (afterLastNodeModulesDirectory[0] === "@") {
    // scoped package
    return `${projectDirectoryUrl}${beforeNodeModulesLastDirectory}${remainingDirectories.slice(0, 2).join("/")}`;
  }

  return `${projectDirectoryUrl}${beforeNodeModulesLastDirectory}${remainingDirectories[0]}/`;
};

const magicExtensionWithImporterExtension = (magicExtensions, importer) => {
  const importerExtension = util.urlToExtension(importer);
  const magicExtensionsWithoutImporterExtension = magicExtensions.filter(ext => ext !== importerExtension);
  return [importerExtension, ...magicExtensionsWithoutImporterExtension];
};

const createFileNotFoundWarning = ({
  specifier,
  importedBy,
  fileUrl,
  magicExtensions
}) => {
  return {
    code: "FILE_NOT_FOUND",
    message: logger.createDetailedMessage(`Cannot find file for "${specifier}"`, {
      "specifier origin": importedBy,
      "file url tried": fileUrl,
      ...(util.urlToExtension(fileUrl) === "" ? {
        ["extensions tried"]: magicExtensions.join(`, `)
      } : {})
    })
  };
};

const formatAutoMappingSpecifierWarning = ({
  importedBy,
  autoMapping,
  closestPackageDirectoryUrl,
  closestPackageObject
}) => {
  return {
    code: "AUTO_MAPPING",
    message: logger.createDetailedMessage(`Auto mapping ${autoMapping.from} to ${autoMapping.to}.`, {
      "specifier origin": importedBy,
      "suggestion": decideAutoMappingSuggestion({
        autoMapping,
        closestPackageDirectoryUrl,
        closestPackageObject
      })
    })
  };
};

const decideAutoMappingSuggestion = ({
  autoMapping,
  closestPackageDirectoryUrl,
  closestPackageObject
}) => {
  if (typeof closestPackageObject.importmap === "string") {
    const packageImportmapFileUrl = util.resolveUrl(closestPackageObject.importmap, closestPackageDirectoryUrl);
    return `To get rid of this warning, add an explicit mapping into importmap file.
${mappingToImportmapString(autoMapping)}
into ${packageImportmapFileUrl}.`;
  }

  return `To get rid of this warning, add an explicit mapping into package.json.
${mappingToExportsFieldString(autoMapping)}
into ${closestPackageDirectoryUrl}package.json.`;
};

const mappingToImportmapString = ({
  scope,
  from,
  to
}) => {
  if (scope) {
    return JSON.stringify({
      scopes: {
        [scope]: {
          [from]: to
        }
      }
    }, null, "  ");
  }

  return JSON.stringify({
    imports: {
      [from]: to
    }
  }, null, "  ");
};

const mappingToExportsFieldString = ({
  scope,
  from,
  to
}) => {
  if (scope) {
    const scopeUrl = util.resolveUrl(scope, "file://");
    const toUrl = util.resolveUrl(to, "file://");
    to = `./${util.urlToRelativeUrl(toUrl, scopeUrl)}`;
  }

  return JSON.stringify({
    exports: {
      [from]: to
    }
  }, null, "  ");
};

const optimizeImportMap = ({
  imports,
  scopes
}) => {
  // remove useless duplicates (scoped key+value already defined on imports)
  const scopesOptimized = {};
  Object.keys(scopes).forEach(scope => {
    const scopeMappings = scopes[scope];
    const scopeMappingsOptimized = {};
    Object.keys(scopeMappings).forEach(mappingKey => {
      const topLevelMappingValue = imports[mappingKey];
      const mappingValue = scopeMappings[mappingKey];

      if (!topLevelMappingValue || topLevelMappingValue !== mappingValue) {
        scopeMappingsOptimized[mappingKey] = mappingValue;
      }
    });

    if (Object.keys(scopeMappingsOptimized).length > 0) {
      scopesOptimized[scope] = scopeMappingsOptimized;
    }
  });
  return {
    imports,
    scopes: scopesOptimized
  };
};

const magicExtensions = [".js", ".json", ".node"];
const resolvePackageMain = ({
  warn,
  packageConditions,
  packageFileUrl,
  packageJsonObject
}) => {
  if (packageConditions.includes("import") && "module" in packageJsonObject) {
    return resolveMainFile({
      warn,
      packageFileUrl,
      packageMainFieldName: "module",
      packageMainFieldValue: packageJsonObject.module
    });
  }

  if (packageConditions.includes("import") && "jsnext:main" in packageJsonObject) {
    return resolveMainFile({
      warn,
      packageFileUrl,
      packageMainFieldName: "jsnext:main",
      packageMainFieldValue: packageJsonObject["jsnext:main"]
    });
  }

  if (packageConditions.includes("browser") && "browser" in packageJsonObject && // when it's an object it means some files
  // should be replaced with an other, let's ignore this when we are searching
  // for the main file
  typeof packageJsonObject.browser === "string") {
    return resolveMainFile({
      warn,
      packageFileUrl,
      packageMainFieldName: "browser",
      packageMainFieldValue: packageJsonObject.browser
    });
  }

  if ("main" in packageJsonObject) {
    return resolveMainFile({
      warn,
      packageFileUrl,
      packageMainFieldName: "main",
      packageMainFieldValue: packageJsonObject.main
    });
  }

  return resolveMainFile({
    warn,
    packageFileUrl,
    packageMainFieldName: "default",
    packageMainFieldValue: "index"
  });
};

const resolveMainFile = async ({
  warn,
  packageFileUrl,
  packageMainFieldName,
  packageMainFieldValue
}) => {
  // main is explicitely empty meaning
  // it is assumed that we should not find a file
  if (packageMainFieldValue === "") {
    return null;
  }

  const packageDirectoryUrl = util.resolveUrl("./", packageFileUrl);
  const mainFileRelativeUrl = packageMainFieldValue.endsWith("/") ? `${packageMainFieldValue}index` : packageMainFieldValue;
  const mainFileUrlFirstCandidate = util.resolveUrl(mainFileRelativeUrl, packageFileUrl);

  if (!mainFileUrlFirstCandidate.startsWith(packageDirectoryUrl)) {
    warn(createPackageMainFileMustBeRelativeWarning({
      packageMainFieldName,
      packageMainFieldValue,
      packageFileUrl
    }));
    return null;
  }

  const mainFileUrl = await resolveFile(mainFileUrlFirstCandidate, {
    magicExtensions
  });

  if (!mainFileUrl) {
    // we know in advance this remapping does not lead to an actual file.
    // we only warn because we have no guarantee this remapping will actually be used
    // in the codebase.
    // warn only if there is actually a main field
    // otherwise the package.json is missing the main field
    // it certainly means it's not important
    if (packageMainFieldName !== "default") {
      warn(createPackageMainFileNotFoundWarning({
        specifier: packageMainFieldValue,
        importedIn: `${packageFileUrl}#${packageMainFieldName}`,
        fileUrl: mainFileUrlFirstCandidate,
        magicExtensions
      }));
    }

    return mainFileUrlFirstCandidate;
  }

  return mainFileUrl;
};

const createPackageMainFileMustBeRelativeWarning = ({
  packageMainFieldName,
  packageMainFieldValue,
  packageFileUrl
}) => {
  return {
    code: "PACKAGE_MAIN_FILE_MUST_BE_RELATIVE",
    message: `${packageMainFieldName} field in package.json must be inside package.json folder.
--- ${packageMainFieldName} ---
${packageMainFieldValue}
--- package.json path ---
${util.urlToFileSystemPath(packageFileUrl)}`
  };
};

const createPackageMainFileNotFoundWarning = ({
  specifier,
  importedIn,
  fileUrl,
  magicExtensions
}) => {
  return {
    code: "PACKAGE_MAIN_FILE_NOT_FOUND",
    message: logger.createDetailedMessage(`Cannot find package main file "${specifier}"`, {
      "imported in": importedIn,
      "file url tried": fileUrl,
      ...(util.urlToExtension(fileUrl) === "" ? {
        ["extensions tried"]: magicExtensions.join(`, `)
      } : {})
    })
  };
};

const visitPackageImportMap = async ({
  warn,
  packageFileUrl,
  packageJsonObject,
  packageImportmap = packageJsonObject.importmap,
  projectDirectoryUrl
}) => {
  if (typeof packageImportmap === "undefined") {
    return {};
  }

  if (typeof packageImportmap === "string") {
    const importmapFileUrl = importMap.resolveUrl(packageImportmap, packageFileUrl);

    try {
      const importmap = await util.readFile(importmapFileUrl, {
        as: "json"
      });
      return importMap.moveImportMap(importmap, importmapFileUrl, projectDirectoryUrl);
    } catch (e) {
      if (e.code === "ENOENT") {
        warn(createPackageImportMapNotFoundWarning({
          importmapFileUrl,
          packageFileUrl
        }));
        return {};
      }

      throw e;
    }
  }

  if (typeof packageImportmap === "object" && packageImportmap !== null) {
    return packageImportmap;
  }

  warn(createPackageImportMapUnexpectedWarning({
    packageImportmap,
    packageFileUrl
  }));
  return {};
};

const createPackageImportMapNotFoundWarning = ({
  importmapFileUrl,
  packageFileUrl
}) => {
  return {
    code: "PACKAGE_IMPORTMAP_NOT_FOUND",
    message: `importmap file specified in a package.json cannot be found,
--- importmap file path ---
${importmapFileUrl}
--- package.json path ---
${packageFileUrl}`
  };
};

const createPackageImportMapUnexpectedWarning = ({
  packageImportmap,
  packageFileUrl
}) => {
  return {
    code: "PACKAGE_IMPORTMAP_UNEXPECTED",
    message: `unexpected value in package.json importmap field: value must be a string or an object.
--- value ---
${packageImportmap}
--- package.json path ---
${util.urlToFileSystemPath(packageFileUrl)}`
  };
};

const specifierIsRelative = specifier => {
  if (specifier.startsWith("//")) {
    return false;
  }

  if (specifier.startsWith("../")) {
    return false;
  } // starts with http:// or file:// or ftp: for instance


  if (/^[a-zA-Z]+\:/.test(specifier)) {
    return false;
  }

  return true;
};

/*

https://nodejs.org/docs/latest-v15.x/api/packages.html#packages_node_js_package_json_field_definitions

*/
const visitPackageImports = ({
  packageFileUrl,
  packageJsonObject,
  packageImports = packageJsonObject.imports,
  packageConditions,
  warn
}) => {
  const importsSubpaths = {};

  const onImportsSubpath = ({
    key,
    value,
    trace
  }) => {
    if (!specifierIsRelative(value)) {
      warn(createSubpathValueMustBeRelativeWarning$1({
        value,
        valueTrace: trace,
        packageFileUrl
      }));
      return;
    }

    const keyNormalized = key;
    const valueNormalized = value;
    importsSubpaths[keyNormalized] = valueNormalized;
  };

  const conditions = [...packageConditions, "default"];

  const visitSubpathValue = (subpathValue, subpathValueTrace) => {
    if (typeof subpathValue === "string") {
      return handleString(subpathValue, subpathValueTrace);
    }

    if (typeof subpathValue === "object" && subpathValue !== null) {
      return handleObject(subpathValue, subpathValueTrace);
    }

    return handleRemaining(subpathValue, subpathValueTrace);
  };

  const handleString = (subpathValue, subpathValueTrace) => {
    const firstBareKey = subpathValueTrace.slice().reverse().find(key => key.startsWith("#"));
    onImportsSubpath({
      key: firstBareKey,
      value: subpathValue,
      trace: subpathValueTrace
    });
    return true;
  };

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
      const bareKeys = [];
      const conditionalKeys = [];
      Object.keys(subpathValue).forEach(availableKey => {
        if (availableKey.startsWith("#")) {
          bareKeys.push(availableKey);
        } else {
          conditionalKeys.push(availableKey);
        }
      });

      if (bareKeys.length > 0 && conditionalKeys.length > 0) {
        warn(createSubpathKeysAreMixedWarning$1({
          subpathValue,
          subpathValueTrace: [...subpathValueTrace, ...conditionTrace],
          packageFileUrl,
          bareKeys,
          conditionalKeys
        }));
        return false;
      } // there is no condition, visit all bare keys (starting with #)


      if (conditionalKeys.length === 0) {
        let leadsToSomething = false;
        bareKeys.forEach(key => {
          leadsToSomething = visitSubpathValue(subpathValue[key], [...subpathValueTrace, ...conditionTrace, key]);
        });
        return leadsToSomething;
      } // there is a condition, keep the first one leading to something


      return conditionalKeys.some(keyCandidate => {
        if (!conditions.includes(keyCandidate)) {
          return false;
        }

        const valueCandidate = subpathValue[keyCandidate];
        return visitSubpathValue(valueCandidate, [...subpathValueTrace, ...conditionTrace, keyCandidate]);
      });
    };

    return followConditionBranch(subpathValue, []);
  };

  const handleRemaining = (subpathValue, subpathValueTrace) => {
    warn(createSubpathIsUnexpectedWarning$1({
      subpathValue,
      subpathValueTrace,
      packageFileUrl
    }));
    return false;
  };

  visitSubpathValue(packageImports, ["imports"]);
  return importsSubpaths;
};

const createSubpathIsUnexpectedWarning$1 = ({
  subpathValue,
  subpathValueTrace,
  packageFileUrl
}) => {
  return {
    code: "IMPORTS_SUBPATH_UNEXPECTED",
    message: `unexpected subpath in package.json imports: value must be an object or a string.
--- value ---
${subpathValue}
--- value at ---
${subpathValueTrace.join(".")}
--- package.json path ---
${util.urlToFileSystemPath(packageFileUrl)}`
  };
};

const createSubpathKeysAreMixedWarning$1 = ({
  subpathValue,
  subpathValueTrace,
  packageFileUrl
}) => {
  return {
    code: "IMPORTS_SUBPATH_MIXED_KEYS",
    message: `unexpected subpath keys in package.json imports: cannot mix bare and conditional keys.
--- value ---
${JSON.stringify(subpathValue, null, "  ")}
--- value at ---
${subpathValueTrace.join(".")}
--- package.json path ---
${util.urlToFileSystemPath(packageFileUrl)}`
  };
};

const createSubpathValueMustBeRelativeWarning$1 = ({
  value,
  valueTrace,
  packageFileUrl
}) => {
  return {
    code: "IMPORTS_SUBPATH_VALUE_UNEXPECTED",
    message: `unexpected subpath value in package.json imports: value must be relative to package
--- value ---
${value}
--- value at ---
${valueTrace.join(".")}
--- package.json path ---
${util.urlToFileSystemPath(packageFileUrl)}`
  };
};

/*

https://nodejs.org/docs/latest-v15.x/api/packages.html#packages_node_js_package_json_field_definitions

*/
const visitPackageExports = ({
  packageFileUrl,
  packageJsonObject,
  packageExports = packageJsonObject.exports,
  packageName = packageJsonObject.name,
  projectDirectoryUrl,
  packageConditions,
  warn
}) => {
  const exportsSubpaths = {};
  const packageDirectoryUrl = util.resolveUrl("./", packageFileUrl);
  const packageDirectoryRelativeUrl = util.urlToRelativeUrl(packageDirectoryUrl, projectDirectoryUrl);

  const onExportsSubpath = ({
    key,
    value,
    trace
  }) => {
    if (!specifierIsRelative(value)) {
      warn(createSubpathValueMustBeRelativeWarning({
        value,
        valueTrace: trace,
        packageFileUrl
      }));
      return;
    }

    const keyNormalized = specifierToSource(key, packageName);
    const valueNormalized = addressToDestination(value, packageDirectoryRelativeUrl);
    exportsSubpaths[keyNormalized] = valueNormalized;
  };

  const conditions = [...packageConditions, "default"];

  const visitSubpathValue = (subpathValue, subpathValueTrace) => {
    // false is allowed as alternative to exports: {}
    if (subpathValue === false) {
      return handleFalse();
    }

    if (typeof subpathValue === "string") {
      return handleString(subpathValue, subpathValueTrace);
    }

    if (typeof subpathValue === "object" && subpathValue !== null) {
      return handleObject(subpathValue, subpathValueTrace);
    }

    return handleRemaining(subpathValue, subpathValueTrace);
  };

  const handleFalse = () => {
    // nothing to do
    return true;
  };

  const handleString = (subpathValue, subpathValueTrace) => {
    const firstRelativeKey = subpathValueTrace.slice().reverse().find(key => key.startsWith("."));
    const key = firstRelativeKey || ".";
    onExportsSubpath({
      key,
      value: subpathValue,
      trace: subpathValueTrace
    });
    return true;
  };

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
      const relativeKeys = [];
      const conditionalKeys = [];
      Object.keys(subpathValue).forEach(availableKey => {
        if (availableKey.startsWith(".")) {
          relativeKeys.push(availableKey);
        } else {
          conditionalKeys.push(availableKey);
        }
      });

      if (relativeKeys.length > 0 && conditionalKeys.length > 0) {
        warn(createSubpathKeysAreMixedWarning({
          subpathValue,
          subpathValueTrace: [...subpathValueTrace, ...conditionTrace],
          packageFileUrl,
          relativeKeys,
          conditionalKeys
        }));
        return false;
      } // there is no condition, visit all relative keys


      if (conditionalKeys.length === 0) {
        let leadsToSomething = false;
        relativeKeys.forEach(key => {
          leadsToSomething = visitSubpathValue(subpathValue[key], [...subpathValueTrace, ...conditionTrace, key]);
        });
        return leadsToSomething;
      } // there is a condition, keep the first one leading to something


      return conditionalKeys.some(keyCandidate => {
        if (!conditions.includes(keyCandidate)) {
          return false;
        }

        const valueCandidate = subpathValue[keyCandidate];
        return visitSubpathValue(valueCandidate, [...subpathValueTrace, ...conditionTrace, keyCandidate]);
      });
    };

    return followConditionBranch(subpathValue, []);
  };

  const handleRemaining = (subpathValue, subpathValueTrace) => {
    warn(createSubpathIsUnexpectedWarning({
      subpathValue,
      subpathValueTrace,
      packageFileUrl
    }));
    return false;
  };

  visitSubpathValue(packageExports, ["exports"]);
  return exportsSubpaths;
};

const specifierToSource = (specifier, packageName) => {
  if (specifier === ".") {
    return packageName;
  }

  if (specifier[0] === "/") {
    return specifier;
  }

  if (specifier.startsWith("./")) {
    return `${packageName}${specifier.slice(1)}`;
  }

  return `${packageName}/${specifier}`;
};

const addressToDestination = (address, packageDirectoryRelativeUrl) => {
  if (address[0] === "/") {
    return address;
  }

  if (address.startsWith("./")) {
    return `./${packageDirectoryRelativeUrl}${address.slice(2)}`;
  }

  return `./${packageDirectoryRelativeUrl}${address}`;
};

const createSubpathIsUnexpectedWarning = ({
  subpathValue,
  subpathValueTrace,
  packageFileUrl
}) => {
  return {
    code: "EXPORTS_SUBPATH_UNEXPECTED",
    message: `unexpected subpath in package.json exports: value must be an object or a string.
--- value ---
${subpathValue}
--- value at ---
${subpathValueTrace.join(".")}
--- package.json path ---
${util.urlToFileSystemPath(packageFileUrl)}`
  };
};

const createSubpathKeysAreMixedWarning = ({
  subpathValue,
  subpathValueTrace,
  packageFileUrl
}) => {
  return {
    code: "EXPORTS_SUBPATH_MIXED_KEYS",
    message: `unexpected subpath keys in package.json exports: cannot mix relative and conditional keys.
--- value ---
${JSON.stringify(subpathValue, null, "  ")}
--- value at ---
${subpathValueTrace.join(".")}
--- package.json path ---
${util.urlToFileSystemPath(packageFileUrl)}`
  };
};

const createSubpathValueMustBeRelativeWarning = ({
  value,
  valueTrace,
  packageFileUrl
}) => {
  return {
    code: "EXPORTS_SUBPATH_VALUE_MUST_BE_RELATIVE",
    message: `unexpected subpath value in package.json exports: value must be a relative to the package.
--- value ---
${value}
--- value at ---
${valueTrace.join(".")}
--- package.json path ---
${util.urlToFileSystemPath(packageFileUrl)}`
  };
};

const applyPackageManualOverride = (packageObject, packagesManualOverrides) => {
  const {
    name,
    version
  } = packageObject;
  const overrideKey = Object.keys(packagesManualOverrides).find(overrideKeyCandidate => {
    if (name === overrideKeyCandidate) {
      return true;
    }

    if (`${name}@${version}` === overrideKeyCandidate) {
      return true;
    }

    return false;
  });

  if (overrideKey) {
    return composeObject(packageObject, packagesManualOverrides[overrideKey]);
  }

  return packageObject;
};

const composeObject = (leftObject, rightObject) => {
  const composedObject = { ...leftObject
  };
  Object.keys(rightObject).forEach(key => {
    const rightValue = rightObject[key];

    if (rightValue === null || typeof rightValue !== "object" || key in leftObject === false) {
      composedObject[key] = rightValue;
    } else {
      const leftValue = leftObject[key];

      if (leftValue === null || typeof leftValue !== "object") {
        composedObject[key] = rightValue;
      } else {
        composedObject[key] = composeObject(leftValue, rightValue);
      }
    }
  });
  return composedObject;
};

const PACKAGE_NOT_FOUND = {};
const PACKAGE_WITH_SYNTAX_ERROR = {};
const readPackageFile = async (packageFileUrl, packagesManualOverrides) => {
  try {
    const packageObject = await util.readFile(packageFileUrl, {
      as: "json"
    });
    return applyPackageManualOverride(packageObject, packagesManualOverrides);
  } catch (e) {
    if (e.code === "ENOENT") {
      return PACKAGE_NOT_FOUND;
    }

    if (e.name === "SyntaxError") {
      console.error(formatPackageSyntaxErrorLog({
        syntaxError: e,
        packageFileUrl
      }));
      return PACKAGE_WITH_SYNTAX_ERROR;
    }

    throw e;
  }
};

const formatPackageSyntaxErrorLog = ({
  syntaxError,
  packageFileUrl
}) => {
  return `
error while parsing package.json.
--- syntax error message ---
${syntaxError.message}
--- package.json path ---
${util.urlToFileSystemPath(packageFileUrl)}
`;
};

const createFindNodeModulePackage = packagesManualOverrides => {
  const readPackageFileMemoized = memoizeAsyncFunctionByUrl(packageFileUrl => {
    return readPackageFile(packageFileUrl, packagesManualOverrides);
  });
  return ({
    projectDirectoryUrl,
    packageFileUrl,
    dependencyName
  }) => {
    const nodeModuleCandidates = getNodeModuleCandidates(packageFileUrl, projectDirectoryUrl);
    return cancellation.firstOperationMatching({
      array: nodeModuleCandidates,
      start: async nodeModuleCandidate => {
        const packageFileUrlCandidate = `${projectDirectoryUrl}${nodeModuleCandidate}${dependencyName}/package.json`;
        const packageObjectCandidate = await readPackageFileMemoized(packageFileUrlCandidate);
        return {
          packageFileUrl: packageFileUrlCandidate,
          packageJsonObject: packageObjectCandidate,
          syntaxError: packageObjectCandidate === PACKAGE_WITH_SYNTAX_ERROR
        };
      },
      predicate: ({
        packageJsonObject
      }) => {
        return packageJsonObject !== PACKAGE_NOT_FOUND;
      }
    });
  };
};

const getNodeModuleCandidates = (fileUrl, projectDirectoryUrl) => {
  const fileDirectoryUrl = util.resolveUrl("./", fileUrl);

  if (fileDirectoryUrl === projectDirectoryUrl) {
    return [`node_modules/`];
  }

  const fileDirectoryRelativeUrl = util.urlToRelativeUrl(fileDirectoryUrl, projectDirectoryUrl);
  const candidates = [];
  const relativeNodeModuleDirectoryArray = fileDirectoryRelativeUrl.split("node_modules/"); // remove the first empty string

  relativeNodeModuleDirectoryArray.shift();
  let i = relativeNodeModuleDirectoryArray.length;

  while (i--) {
    candidates.push(`node_modules/${relativeNodeModuleDirectoryArray.slice(0, i + 1).join("node_modules/")}node_modules/`);
  }

  return [...candidates, "node_modules/"];
};

const getImportMapFromPackageFiles = async ({
  // nothing is actually listening for this cancellationToken for now
  // it's not very important but it would be better to register on it
  // an stops what we are doing if asked to do so
  // cancellationToken = createCancellationTokenForProcess(),
  logger,
  warn,
  projectDirectoryUrl,
  projectPackageDevDependenciesIncluded = process.env.NODE_ENV !== "production",
  packageConditions = ["import", "browser"],
  packagesManualOverrides = {},
  packageIncludedPredicate = () => true
}) => {
  projectDirectoryUrl = util.assertAndNormalizeDirectoryUrl(projectDirectoryUrl);
  const projectPackageFileUrl = util.resolveUrl("./package.json", projectDirectoryUrl);
  const findNodeModulePackage = createFindNodeModulePackage(packagesManualOverrides);
  const imports = {};
  const scopes = {};

  const addMapping = ({
    scope,
    from,
    to
  }) => {
    if (scope) {
      // when a package says './' maps to './'
      // we must add something to say if we are already inside the package
      // no need to ensure leading slash are scoped to the package
      if (from === "./" && to === scope) {
        addMapping({
          scope,
          from: scope,
          to: scope
        });
        const packageName = scope.slice(scope.lastIndexOf("node_modules/") + `node_modules/`.length);
        addMapping({
          scope,
          from: packageName,
          to: scope
        });
      }

      scopes[scope] = { ...(scopes[scope] || {}),
        [from]: to
      };
    } else {
      // we could think it's useless to remap from with to
      // however it can be used to ensure a weaker remapping
      // does not win over this specific file or folder
      if (from === to) {
        /**
         * however remapping '/' to '/' is truly useless
         * moreover it would make wrapImportMap create something like
         * {
         *   imports: {
         *     "/": "/.dist/best/"
         *   }
         * }
         * that would append the wrapped folder twice
         * */
        if (from === "/") return;
      }

      imports[from] = to;
    }
  };

  const seen = {};

  const markPackageAsSeen = (packageFileUrl, importerPackageFileUrl) => {
    if (packageFileUrl in seen) {
      seen[packageFileUrl].push(importerPackageFileUrl);
    } else {
      seen[packageFileUrl] = [importerPackageFileUrl];
    }
  };

  const packageIsSeen = (packageFileUrl, importerPackageFileUrl) => {
    return packageFileUrl in seen && seen[packageFileUrl].includes(importerPackageFileUrl);
  };

  const visit = async ({
    packageFileUrl,
    packageName,
    packageJsonObject,
    importerPackageFileUrl,
    importerPackageJsonObject,
    includeDevDependencies
  }) => {
    if (!packageIncludedPredicate({
      packageName,
      packageFileUrl,
      packageJsonObject
    })) {
      return;
    }

    await visitDependencies({
      packageFileUrl,
      packageJsonObject,
      includeDevDependencies
    });
    await visitPackage({
      packageFileUrl,
      packageName,
      packageJsonObject,
      importerPackageFileUrl,
      importerPackageJsonObject
    });
  };

  const visitPackage = async ({
    packageFileUrl,
    packageName,
    packageJsonObject,
    importerPackageFileUrl
  }) => {
    const packageInfo = computePackageInfo({
      packageFileUrl,
      packageName,
      importerPackageFileUrl
    });
    await visitPackageMain({
      packageFileUrl,
      packageName,
      packageJsonObject,
      packageInfo
    });
    const {
      importerIsRoot,
      importerRelativeUrl,
      packageIsRoot,
      packageDirectoryRelativeUrl // packageDirectoryUrl,
      // packageDirectoryUrlExpected,

    } = packageInfo;

    const addImportMapForPackage = importMap => {
      if (packageIsRoot) {
        const {
          imports = {},
          scopes = {}
        } = importMap;
        Object.keys(imports).forEach(from => {
          addMapping({
            from,
            to: imports[from]
          });
        });
        Object.keys(scopes).forEach(scope => {
          const scopeMappings = scopes[scope];
          Object.keys(scopeMappings).forEach(key => {
            addMapping({
              scope,
              from: key,
              to: scopeMappings[key]
            });
          });
        });
        return;
      }

      const {
        imports = {},
        scopes = {}
      } = importMap;
      const scope = `./${packageDirectoryRelativeUrl}`;
      Object.keys(imports).forEach(from => {
        const to = imports[from];
        const toMoved = moveMappingValue(to, packageFileUrl, projectDirectoryUrl);
        addMapping({
          scope,
          from,
          to: toMoved
        });
      });
      Object.keys(scopes).forEach(scope => {
        const scopeMappings = scopes[scope];
        const scopeMoved = moveMappingValue(scope, packageFileUrl, projectDirectoryUrl);
        Object.keys(scopeMappings).forEach(key => {
          const to = scopeMappings[key];
          const toMoved = moveMappingValue(to, packageFileUrl, projectDirectoryUrl);
          addMapping({
            scope: scopeMoved,
            from: key,
            to: toMoved
          });
        });
      });
    };

    const addMappingsForPackageAndImporter = mappings => {
      if (packageIsRoot) {
        Object.keys(mappings).forEach(from => {
          const to = mappings[from];
          addMapping({
            from,
            to
          });
        });
        return;
      }

      if (importerIsRoot) {
        // own package mappings available to himself
        Object.keys(mappings).forEach(from => {
          const to = mappings[from];
          addMapping({
            scope: `./${packageDirectoryRelativeUrl}`,
            from,
            to
          });
          addMapping({
            from,
            to
          });
        }); // if importer is root no need to make package mappings available to the importer
        // because they are already on top level mappings

        return;
      }

      Object.keys(mappings).forEach(from => {
        const to = mappings[from]; // own package exports available to himself

        addMapping({
          scope: `./${packageDirectoryRelativeUrl}`,
          from,
          to
        }); // now make package exports available to the importer
        // here if the importer is himself we could do stuff
        // we should even handle the case earlier to prevent top level remapping

        addMapping({
          scope: `./${importerRelativeUrl}`,
          from,
          to
        });
      });
    }; // https://nodejs.org/docs/latest-v15.x/api/packages.html#packages_name


    addImportMapForPackage({
      imports: {
        [`${packageName}/`]: `./`
      }
    });
    const importsFromPackageField = await visitPackageImportMap({
      warn,
      packageFileUrl,
      packageJsonObject,
      projectDirectoryUrl
    });
    addImportMapForPackage(importsFromPackageField);

    if ("imports" in packageJsonObject) {
      const mappingsFromPackageExports = {};
      const packageImports = visitPackageImports({
        warn,
        packageFileUrl,
        packageJsonObject,
        packageName,
        projectDirectoryUrl,
        packageConditions
      });
      Object.keys(packageImports).forEach(from => {
        const to = packageImports[from];
        mappingsFromPackageExports[from] = to;
      });
      addImportMapForPackage({
        imports: mappingsFromPackageExports
      });
    }

    if ("exports" in packageJsonObject) {
      const mappingsFromPackageExports = {};
      const packageExports = visitPackageExports({
        warn,
        packageFileUrl,
        packageJsonObject,
        packageName,
        projectDirectoryUrl,
        packageConditions
      });
      Object.keys(packageExports).forEach(from => {
        const to = packageExports[from];

        if (from.indexOf("*") === -1) {
          mappingsFromPackageExports[from] = to;
          return;
        }

        if (from.endsWith("/*") && to.endsWith("/*") && // ensure ends with '*' AND there is only one '*' occurence
        to.indexOf("*") === to.length - 1) {
          const fromWithouTrailingStar = from.slice(0, -1);
          const toWithoutTrailingStar = to.slice(0, -1);
          mappingsFromPackageExports[fromWithouTrailingStar] = toWithoutTrailingStar;
          return;
        }

        warn(createExportsWildcardIgnoredWarning({
          key: from,
          value: to,
          packageFileUrl
        }));
      });
      addMappingsForPackageAndImporter(mappingsFromPackageExports);
    }
  };

  const visitPackageMain = async ({
    packageFileUrl,
    packageName,
    packageJsonObject,
    packageInfo: {
      importerIsRoot,
      importerRelativeUrl,
      packageDirectoryUrl,
      packageDirectoryUrlExpected
    }
  }) => {
    const mainFileUrl = await resolvePackageMain({
      warn,
      packageConditions,
      packageFileUrl,
      packageJsonObject
    }); // it's possible to have no main
    // like { main: "" } in package.json
    // or a main that does not lead to an actual file

    if (mainFileUrl === null) {
      return;
    }

    const mainFileRelativeUrl = util.urlToRelativeUrl(mainFileUrl, projectDirectoryUrl);
    const from = packageName;
    const to = `./${mainFileRelativeUrl}`;

    if (importerIsRoot) {
      addMapping({
        from,
        to
      });
    } else {
      addMapping({
        scope: `./${importerRelativeUrl}`,
        from,
        to
      });
    }

    if (packageDirectoryUrl !== packageDirectoryUrlExpected) {
      addMapping({
        scope: `./${importerRelativeUrl}`,
        from,
        to
      });
    }
  };

  const visitDependencies = async ({
    packageFileUrl,
    packageJsonObject,
    includeDevDependencies
  }) => {
    const dependencyMap = packageDependenciesFromPackageObject(packageJsonObject, {
      includeDevDependencies
    });
    await Promise.all(Object.keys(dependencyMap).map(async dependencyName => {
      const dependencyInfo = dependencyMap[dependencyName];
      await visitDependency({
        packageFileUrl,
        packageJsonObject,
        dependencyName,
        dependencyInfo
      });
    }));
  };

  const visitDependency = async ({
    packageFileUrl,
    packageJsonObject,
    dependencyName,
    dependencyInfo
  }) => {
    const dependencyData = await findDependency({
      packageFileUrl,
      dependencyName
    });

    if (!dependencyData) {
      const cannotFindPackageWarning = createCannotFindPackageWarning({
        dependencyName,
        dependencyInfo,
        packageFileUrl
      });

      if (dependencyInfo.isOptional) {
        logger.debug(cannotFindPackageWarning.message);
      } else {
        warn(cannotFindPackageWarning);
      }

      return;
    }

    if (dependencyData.syntaxError) {
      return;
    }

    const {
      packageFileUrl: dependencyPackageFileUrl,
      packageJsonObject: dependencyPackageJsonObject
    } = dependencyData;

    if (packageIsSeen(dependencyPackageFileUrl, packageFileUrl)) {
      return;
    }

    markPackageAsSeen(dependencyPackageFileUrl, packageFileUrl);
    await visit({
      packageFileUrl: dependencyPackageFileUrl,
      packageName: dependencyName,
      packageJsonObject: dependencyPackageJsonObject,
      importerPackageFileUrl: packageFileUrl,
      importerPackageJsonObject: packageJsonObject
    });
  };

  const computePackageInfo = ({
    packageFileUrl,
    packageName,
    importerPackageFileUrl
  }) => {
    const importerIsRoot = importerPackageFileUrl === projectPackageFileUrl;
    const importerPackageDirectoryUrl = util.resolveUrl("./", importerPackageFileUrl);
    const importerRelativeUrl = util.urlToRelativeUrl(importerPackageDirectoryUrl, projectDirectoryUrl);
    const packageIsRoot = packageFileUrl === projectPackageFileUrl;
    const packageDirectoryUrl = util.resolveUrl("./", packageFileUrl);
    const packageDirectoryUrlExpected = `${importerPackageDirectoryUrl}node_modules/${packageName}/`;
    const packageDirectoryRelativeUrl = util.urlToRelativeUrl(packageDirectoryUrl, projectDirectoryUrl);
    return {
      importerIsRoot,
      importerRelativeUrl,
      packageIsRoot,
      packageDirectoryUrl,
      packageDirectoryUrlExpected,
      packageDirectoryRelativeUrl
    };
  };

  const dependenciesCache = {};

  const findDependency = ({
    packageFileUrl,
    dependencyName
  }) => {
    if (packageFileUrl in dependenciesCache === false) {
      dependenciesCache[packageFileUrl] = {};
    }

    if (dependencyName in dependenciesCache[packageFileUrl]) {
      return dependenciesCache[packageFileUrl][dependencyName];
    }

    const dependencyPromise = findNodeModulePackage({
      projectDirectoryUrl,
      packageFileUrl,
      dependencyName
    });
    dependenciesCache[packageFileUrl][dependencyName] = dependencyPromise;
    return dependencyPromise;
  };

  const projectPackageJsonObject = await util.readFile(projectPackageFileUrl, {
    as: "json"
  });
  const importerPackageFileUrl = projectPackageFileUrl;
  markPackageAsSeen(projectPackageFileUrl, importerPackageFileUrl);
  const packageName = projectPackageJsonObject.name;

  if (typeof packageName !== "string") {
    warn(createPackageNameMustBeAStringWarning({
      packageName,
      packageFileUrl: projectPackageFileUrl
    }));
    return {};
  }

  await visit({
    packageFileUrl: projectPackageFileUrl,
    packageName: projectPackageJsonObject.name,
    packageJsonObject: projectPackageJsonObject,
    importerPackageFileUrl,
    importerPackageJsonObject: null,
    includeDevDependencies: projectPackageDevDependenciesIncluded
  });
  return optimizeImportMap({
    imports,
    scopes
  });
};

const packageDependenciesFromPackageObject = (packageObject, {
  includeDevDependencies
}) => {
  const packageDependencies = {};
  const {
    dependencies = {}
  } = packageObject; // https://npm.github.io/using-pkgs-docs/package-json/types/optionaldependencies.html

  const {
    optionalDependencies = {}
  } = packageObject;
  Object.keys(dependencies).forEach(dependencyName => {
    packageDependencies[dependencyName] = {
      type: "dependency",
      isOptional: dependencyName in optionalDependencies,
      versionPattern: dependencies[dependencyName]
    };
  });
  const {
    peerDependencies = {}
  } = packageObject;
  const {
    peerDependenciesMeta = {}
  } = packageObject;
  Object.keys(peerDependencies).forEach(dependencyName => {
    packageDependencies[dependencyName] = {
      type: "peerDependency",
      versionPattern: peerDependencies[dependencyName],
      isOptional: dependencyName in peerDependenciesMeta && peerDependenciesMeta[dependencyName].optional
    };
  });

  if (includeDevDependencies) {
    const {
      devDependencies = {}
    } = packageObject;
    Object.keys(devDependencies).forEach(dependencyName => {
      if (!packageDependencies.hasOwnProperty(dependencyName)) {
        packageDependencies[dependencyName] = {
          type: "devDependency",
          versionPattern: devDependencies[dependencyName]
        };
      }
    });
  }

  return packageDependencies;
};

const moveMappingValue = (address, from, to) => {
  const url = util.resolveUrl(address, from);
  const relativeUrl = util.urlToRelativeUrl(url, to);

  if (relativeUrl.startsWith("../")) {
    return relativeUrl;
  }

  if (relativeUrl.startsWith("./")) {
    return relativeUrl;
  }

  if (/^[a-zA-Z]{2,}:/.test(relativeUrl)) {
    // has sheme
    return relativeUrl;
  }

  return `./${relativeUrl}`;
};

const createExportsWildcardIgnoredWarning = ({
  key,
  value,
  packageFileUrl
}) => {
  return {
    code: "EXPORTS_WILDCARD",
    message: `Ignoring export using "*" because it is not supported by importmap.
--- key ---
${key}
--- value ---
${value}
--- package.json path ---
${util.urlToFileSystemPath(packageFileUrl)}
--- see also ---
https://github.com/WICG/import-maps/issues/232`
  };
};

const createPackageNameMustBeAStringWarning = ({
  packageName,
  packageFileUrl
}) => {
  return {
    code: "PACKAGE_NAME_MUST_BE_A_STRING",
    message: `package name field must be a string
--- package name field ---
${packageName}
--- package.json file path ---
${packageFileUrl}`
  };
};

const createCannotFindPackageWarning = ({
  dependencyName,
  dependencyInfo,
  packageFileUrl
}) => {
  const dependencyIsOptional = dependencyInfo.isOptional;
  const dependencyType = dependencyInfo.type;
  const dependencyVersionPattern = dependencyInfo.versionPattern;
  return {
    code: "CANNOT_FIND_PACKAGE",
    message: logger.createDetailedMessage(dependencyIsOptional ? `cannot find an optional ${dependencyType}.` : `cannot find a ${dependencyType}.`, {
      [dependencyType]: `${dependencyName}@${dependencyVersionPattern}`,
      "required by": util.urlToFileSystemPath(packageFileUrl)
    })
  };
};

const getImportMapFromProjectFiles = async ({
  logLevel,
  projectDirectoryUrl,
  runtime = "browser",
  moduleFormat = "esm",
  dev = false,
  jsFiles = true,
  importMapInput = {},
  projectPackageDevDependenciesIncluded = dev,
  treeshakeMappings = !dev,
  packageConditions = [],
  packageConditionDevelopment = dev,
  packageConditionFromModuleFormat = packageConditionsFromModuleFormat[moduleFormat],
  packageConditionFromRuntime = packageConditionsFromRuntime[runtime],
  magicExtensions = [".js", ".jsx", ".ts", ".tsx", ".node", ".json"],
  onWarn = (warning, warn) => {
    warn(warning);
  },
  ...rest
}) => {
  packageConditions = [...(packageConditionDevelopment ? ["development"] : ["production"]), ...(packageConditionFromModuleFormat ? [packageConditionFromModuleFormat] : []), ...(packageConditionFromRuntime ? [packageConditionFromRuntime] : []), ...packageConditions];
  const logger$1 = logger.createLogger({
    logLevel
  });

  const warn = warning => {
    onWarn(warning, () => {
      logger$1.warn(`\n${warning.message}\n`);
    });
  }; // At this point, importmap is relative to the project directory url


  let importMapFromPackageFiles = await getImportMapFromPackageFiles({
    logger: logger$1,
    warn,
    projectDirectoryUrl,
    packageConditions,
    projectPackageDevDependenciesIncluded,
    ...rest
  });
  importMapFromPackageFiles = importMap.sortImportMap(importMap.composeTwoImportMaps(importMapInput, importMapFromPackageFiles));

  if (!jsFiles) {
    return importMapFromPackageFiles;
  }

  let importMapFromJsFiles = await getImportMapFromJsFiles({
    warn,
    projectDirectoryUrl,
    importMap: importMapFromPackageFiles,
    magicExtensions,
    runtime,
    treeshakeMappings
  });
  importMapFromJsFiles = importMap.sortImportMap(importMapFromJsFiles);
  return importMapFromJsFiles;
};
const packageConditionsFromRuntime = {
  browser: "browser",
  node: "node"
};
const packageConditionsFromModuleFormat = {
  esm: "import",
  cjs: "require"
};

const getImportMapFromFile = async ({
  projectDirectoryUrl,
  importMapFileRelativeUrl
}) => {
  projectDirectoryUrl = util.assertAndNormalizeDirectoryUrl(projectDirectoryUrl);
  const importmapFileUrl = util.resolveUrl(importMapFileRelativeUrl, projectDirectoryUrl);
  const importmap = await util.readFile(importmapFileUrl, {
    as: "json"
  }); // ensure the importmap is now relative to the project directory url
  // we do that because writeImportMapFile expect all importmap
  // to be relative to the projectDirectoryUrl

  const importmapFakeRootUrl = util.resolveUrl("whatever.importmap", projectDirectoryUrl);
  const importmapRelativeToProject = importMap.moveImportMap(importmap, importmapFileUrl, importmapFakeRootUrl);
  return importMap.sortImportMap(importmapRelativeToProject);
};

const importMapToVsCodeConfigPaths = ({
  imports = {}
}) => {
  const paths = {};
  Object.keys(imports).forEach(importKey => {
    const importValue = imports[importKey];
    let key;

    if (importKey.endsWith("/")) {
      key = `${importKey}*`;
    } else {
      key = importKey;
    }

    const importValueArray = typeof importValue === "string" ? [importValue] : importValue;
    const candidatesForPath = importValueArray.map(importValue => {
      if (importValue.endsWith("/")) {
        return `${importValue}*`;
      }

      return importValue;
    });

    if (key in paths) {
      paths[key] = [...paths[key], ...candidatesForPath];
    } else {
      paths[key] = candidatesForPath;
    }
  });
  return paths;
};

const writeImportMapFile = async (importMapInputs = [], {
  projectDirectoryUrl,
  importMapFile = true,
  // in case someone wants the importmap but not write it on filesystem
  importMapFileRelativeUrl = "./import-map.importmap",
  importMapFileLog = true,
  jsConfigFile = false,
  // not yet documented, makes vscode aware of the import remapping
  jsConfigFileLog = true,
  jsConfigLeadingSlash = false
}) => {
  projectDirectoryUrl = util.assertAndNormalizeDirectoryUrl(projectDirectoryUrl);

  if (importMapInputs.length === 0) {
    console.warn(`importMapInputs is empty, the generated importmap will be empty`);
  }

  const importMaps = await Promise.all(importMapInputs);
  const importMap$1 = importMaps.reduce((previous, current) => {
    return importMap.composeTwoImportMaps(previous, current);
  }, {});

  if (importMapFile) {
    const importMapFileUrl = util.resolveUrl(importMapFileRelativeUrl, projectDirectoryUrl);
    await util.writeFile(importMapFileUrl, JSON.stringify(importMap$1, null, "  "));

    if (importMapFileLog) {
      console.info(`-> ${util.urlToFileSystemPath(importMapFileUrl)}`);
    }
  }

  if (jsConfigFile) {
    const jsConfigFileUrl = util.resolveUrl("./jsconfig.json", projectDirectoryUrl);
    const jsConfigCurrent = (await readCurrentJsConfig(jsConfigFileUrl)) || {
      compilerOptions: {}
    };
    const jsConfig = { ...jsConfigDefault,
      ...jsConfigCurrent,
      compilerOptions: { ...jsConfigDefault.compilerOptions,
        ...jsConfigCurrent.compilerOptions,
        paths: { ...(jsConfigLeadingSlash ? {
            "/*": ["./*"]
          } : {}),
          ...importMapToVsCodeConfigPaths(importMap$1)
        }
      }
    };
    await util.writeFile(jsConfigFileUrl, JSON.stringify(jsConfig, null, "  "));

    if (jsConfigFileLog) {
      console.info(`-> ${util.urlToFileSystemPath(jsConfigFileUrl)}`);
    }
  }

  return importMap$1;
};

const readCurrentJsConfig = async jsConfigFileUrl => {
  try {
    const currentJSConfig = await util.readFile(jsConfigFileUrl, {
      as: "json"
    });
    return currentJSConfig;
  } catch (e) {
    return null;
  }
};

const jsConfigDefault = {
  compilerOptions: {
    baseUrl: ".",
    paths: {}
  }
};

exports.getImportMapFromFile = getImportMapFromFile;
exports.getImportMapFromProjectFiles = getImportMapFromProjectFiles;
exports.writeImportMapFile = writeImportMapFile;

//# sourceMappingURL=jsenv_node_module_importmap.cjs.map