const path = require("path");
const fs = require("fs");
const InjectLoader = require("../../src/InjectLoader.js");
const TracerCodeGenerator = require("../../src/TracerCodeGenerator.js");

const targetsConfig = {
    CEditorPage: ["Name"]
};

describe("InjectConstructorCodePlugin", () => {
    const indexFile = path.join(__dirname, "src", "index.js");
    let source = "";

    /**
     * @type { InjectLoader }
     */
    let loader;

    beforeAll((done) => {
        source = fs.readFileSync(indexFile, { encoding: "utf-8" });
        done();
    });

    beforeEach((done) => {
        loader = new InjectLoader({
            targets: new Set(Object.keys(targetsConfig)),
            generateCode: {
                construct: ({ className }) => {
                    if (targetsConfig[className]) {
                        return TracerCodeGenerator.observePropertyAll(className, targetsConfig[className]).trim();
                    }
                    return "";
                }
            },
        });

        done();
    });

    test("insert into constructor", () => {
        const newCode = loader.processCode(source);

        Object.keys(targetsConfig).forEach(className => {
            const classProps = targetsConfig[className];

            classProps.forEach((propName) => {
                const pos = newCode.indexOf(TracerCodeGenerator.observeProperty(className, propName));
                expect(pos > -1).toBe(true);
            });
        });

        expect(newCode.includes("__WEBPACK_TRACER_PATCHED_CLASSES__")).toBe(true);
        expect(newCode.includes("'CEditorPage'")).toBe(true);
    });

    test("targets callback: true => inject", () => {
        const loaderByCallback = new InjectLoader({
            targets: (className) => className === "CEditorPage",
            generateCode: {
                construct: ({ className }) => TracerCodeGenerator.observeAllProperties(className)
            },
        });

        const newCode = loaderByCallback.processCode(source);
        expect(newCode.includes("Tracer.observeAllProperties(this, 'CEditorPage');")).toBe(true);
        expect(newCode.includes("__WEBPACK_TRACER_PATCHED_CLASSES__")).toBe(true);
    });

    test("targets callback: false => skip inject", () => {
        const loaderByCallback = new InjectLoader({
            targets: () => false,
            generateCode: {
                construct: ({ className }) => TracerCodeGenerator.observeAllProperties(className)
            },
        });

        const newCode = loaderByCallback.processCode(source);
        expect(newCode.includes("Tracer.observeAllProperties(")).toBe(false);
        expect(newCode.includes("__WEBPACK_TRACER_PATCHED_CLASSES__")).toBe(false);
    });

    test("insertPosition=end puts code after constructor body statements", () => {
        const loaderByCallback = new InjectLoader({
            targets: (className) => className === "CEditorPage",
            insertPosition: "end",
            generateCode: {
                construct: () => "window.__trace_insert_position = 'END';"
            },
        });

        const newCode = loaderByCallback.processCode(source);
        const markerPos = newCode.indexOf("window.__trace_insert_position = 'END';");
        const nameAssignPos = newCode.indexOf("this.Name");
        expect(markerPos > nameAssignPos).toBe(true);
    });

    test("insertPosition=start puts code before constructor body statements", () => {
        const loaderByCallback = new InjectLoader({
            targets: (className) => className === "CEditorPage",
            insertPosition: "start",
            generateCode: {
                construct: () => "window.__trace_insert_position = 'START';"
            },
        });

        const newCode = loaderByCallback.processCode(source);
        const markerPos = newCode.indexOf("window.__trace_insert_position = 'START';");
        const nameAssignPos = newCode.indexOf("this.Name");
        expect(markerPos > -1).toBe(true);
        expect(markerPos < nameAssignPos).toBe(true);
    });
});
