const SWCInjectLoader = require("../../src/SWCInjectLoader.js");

describe("SWCInjectLoader cache", () => {
    test("reuses cache for same source+file+options", async () => {
        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                construct: ({ className }) => `window.__cache_test='${className}';`
            }
        });

        let calls = 0;
        loader.processWithAST = async (sourceCode) => {
            calls += 1;
            return `${sourceCode}\n/*patched*/`;
        };

        const source = "class CEditorPage { constructor() {} }";
        const filePath = "C:/tmp/HtmlPage.js";

        const first = await loader.processCode(source, filePath);
        const second = await loader.processCode(source, filePath);

        expect(first).toBe(second);
        expect(calls).toBe(1);
    });

    test("invalidates cache when source changes", async () => {
        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                construct: ({ className }) => `window.__cache_test='${className}';`
            }
        });

        let calls = 0;
        loader.processWithAST = async (sourceCode) => {
            calls += 1;
            return `${sourceCode}\n/*patched-${calls}*/`;
        };

        const filePath = "C:/tmp/HtmlPage.js";
        const source1 = "class CEditorPage { constructor() {} }";
        const source2 = "class CEditorPage { constructor() { this.a = 1; } }";

        const first = await loader.processCode(source1, filePath);
        const second = await loader.processCode(source2, filePath);

        expect(first).not.toBe(second);
        expect(calls).toBe(2);
    });

    test("updateOptions clears cache and forces recalculation", async () => {
        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                construct: ({ className }) => `window.__cache_test='${className}';`
            }
        });

        let calls = 0;
        loader.processWithAST = async (sourceCode) => {
            calls += 1;
            return `${sourceCode}\n/*patched-${calls}*/`;
        };

        const source = "class CEditorPage { constructor() {} }";
        const filePath = "C:/tmp/HtmlPage.js";

        const first = await loader.processCode(source, filePath);
        loader.updateOptions({
            generateCode: {
                construct: ({ className }) => `window.__cache_test_2='${className}';`
            }
        });
        const second = await loader.processCode(source, filePath);

        expect(first).not.toBe(second);
        expect(calls).toBe(2);
    });
});
