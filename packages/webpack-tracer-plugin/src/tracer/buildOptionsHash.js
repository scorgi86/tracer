const pluginPkg = require("../../package.json");
const swcPkg = require("@swc/core/package.json");

module.exports = function buildOptionsHash(opts) {
    const pluginVersion = pluginPkg && pluginPkg.version ? pluginPkg.version : "unknown";
    const swcVersion = swcPkg && swcPkg.version ? swcPkg.version : "unknown";
    const targets = typeof opts.targets === "function"
        ? `fn:${opts.targetsCallbackKey || opts.targets.toString()}`
        : Array.from(opts.targets || []).sort();
    const classConfig = Array.from((opts.classConfig || new Map()).entries())
        .sort(([a], [b]) => a.localeCompare(b));
    const flags = {
        trackPrototypes: opts.trackPrototypes !== false,
        trackInheritance: opts.trackInheritance !== false,
        debug: !!opts.debug,
        allowTargetsCallbackInDebug: opts.allowTargetsCallbackInDebug === true,
        targetsCallbackEnabled: opts.targetsCallbackEnabled === true,
        disableProcessCache: opts.disableProcessCache === true,
    };

    const generateCodeSig = opts.generateCode?.onConstructor
        ? opts.generateCode.onConstructor.toString()
        : "";
    const generateAfterLastPrototypeAssignSig = opts.generateCode?.onAfterLastPrototypeAssign
        ? opts.generateCode.onAfterLastPrototypeAssign.toString()
        : "";
    const generateBeforeEndModuleSig = opts.generateCode?.onBeforeEndModule
        ? opts.generateCode.onBeforeEndModule.toString()
        : "";

    return JSON.stringify({
        pluginVersion,
        swcVersion,
        targets,
        classConfig,
        flags,
        generateCodeSig,
        generateAfterLastPrototypeAssignSig,
        generateBeforeEndModuleSig,
        fileSignatureHooks: [
            "onConstructor",
            "onAfterLastPrototypeAssign",
            "onBeforeEndModule",
        ].filter((hookName) => typeof opts.generateCode?.[hookName] === "function"),
    });
};
