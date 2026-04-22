const { Tracer } = require("../dist/tracer.umd.js");

let seq = 0;
const nextPrefix = () => `ed_${Date.now()}_${seq++}_`;

const clearSubscriptions = () => {
  Tracer.untraceAll();
  Tracer.untraceCalls();
  Tracer.untraceProperties();
};

const defineCommonSlicesFromEditorsTracer = (prefix) => {
  const appTimer = `${prefix}AppTimerTick`;
  const autoSave = `${prefix}AutoSaveTick`;
  const docLoaded = `${prefix}DocLoaded`;
  const docLoading = `${prefix}DocLoading`;
  const clipboardPaste = `${prefix}ClipboardPaste`;

  Tracer.defineSlice(appTimer, {
    predicate: ({ fnKey, className }) =>
      className.indexOf("CEditorPage") > -1 && fnKey === "onTimerScroll",
    beforeCall: () => true,
    afterCall: () => false,
  });

  Tracer.defineSlice(autoSave, {
    predicate: ({ fnKey, className, tracerState }) =>
      tracerState.get(appTimer) === false &&
      className.indexOf("baseEditorsApi") > -1 &&
      fnKey === "_autoSave",
    beforeCall: () => true,
    afterCall: () => false,
  });

  Tracer.defineSlice(docLoaded, {
    initial: false,
    predicate: (args) => args.fnKey === "onDocumentContentReady",
    beforeCall: () => false,
    afterCall: () => true,
  });

  Tracer.defineSlice(docLoading, {
    initial: true,
    predicate: (args) => args.tracerState.get(docLoaded) !== true,
    beforeCall: (args) => args.tracerState.get(docLoaded) !== true,
    afterCall: (args) => args.tracerState.get(docLoaded) === true,
  });

  Tracer.defineSlice(clipboardPaste, ({ className, fnKey }) => {
    return (
      className === "CClipboardBase" &&
      fnKey.toLowerCase().indexOf("_private_onpaste") > -1
    );
  });

  return { appTimer, autoSave, docLoaded, docLoading, clipboardPaste };
};

const runWordObserveFromEditorsTracer = (TracerApi, win) => {
  TracerApi.observePrototypesFromExports(win.AscCommonWord);
  TracerApi.observePrototypesFromExports(win.AscFormat);
  TracerApi.observePrototypesFromExports(win.AscWord);

  win.AscCommonWord.BinaryFileReader = TracerApi.observeConstructor(
    win.AscCommonWord.BinaryFileReader,
  );
  win.AscCommonWord.BinaryFileWriter = TracerApi.observeConstructor(
    win.AscCommonWord.BinaryFileWriter,
  );

  TracerApi.observeFromExports(win.Asc);
  TracerApi.observeFromExports(win.AscCommon);
  TracerApi.observeFromExports(win.AscCommonWord);

  win.AscCommonWord = new Proxy(win.AscCommonWord, {
    get(target, prop) {
      if (
        prop === "CEditorPage" &&
        target[prop] &&
        target[prop].isProxyConstructor !== true
      ) {
        return TracerApi.observeConstructor(Reflect.get(target, prop));
      }
      return Reflect.get(target, prop);
    },
    set(target, prop, value) {
      if (prop === "CEditorPage" && value.isProxyConstructor !== true) {
        value = TracerApi.observeConstructor(value);
      }
      return Reflect.set(target, prop, value);
    },
  });
};

const runSlideObserveFromEditorsTracer = (TracerApi, win) => {
  TracerApi.observePrototypesFromExports(win.AscCommonWord);
  TracerApi.observePrototypesFromExports(win.AscFormat);
  TracerApi.observePrototypesFromExports(win.AscWord);

  win.AscCommonWord.BinaryFileReader = TracerApi.observeConstructor(
    win.AscCommonWord.BinaryFileReader,
  );
  win.AscCommonWord.BinaryFileWriter = TracerApi.observeConstructor(
    win.AscCommonWord.BinaryFileWriter,
  );

  TracerApi.observePrototypesFromExports(win.Asc);
  TracerApi.observePrototypesFromExports(win.AscCommon);
  TracerApi.observePrototypesFromExports(win.AscCommonWord);
  TracerApi.observePrototypesFromExports(win.AscCommonSlide);

  TracerApi.observe(Object.getPrototypeOf(win.AscCommon.g_clipboardBase), "CClipboardBase");
  TracerApi.observePrototype(win.Asc.asc_docs_api);
};

describe("editors-tracer derived scenarios", () => {
  beforeEach(() => {
    Tracer.setTraceProfile("full");
  });

  afterEach(() => {
    clearSubscriptions();
    Tracer.setTraceProfile("balanced");
  });

  test("common slices: AppTimerTick + AutoSaveTick activate on expected calls", () => {
    const names = defineCommonSlicesFromEditorsTracer(nextPrefix());
    const sliceHits = [];

    const editor = {
      onTimerScroll() {
        return "tick";
      },
    };
    const api = {
      _autoSave() {
        return "saved";
      },
    };

    Tracer.observe(editor, "CEditorPage");
    Tracer.observe(api, "baseEditorsApi");

    Tracer.traceBySlice(names.appTimer, (e) => sliceHits.push(`timer:${e.fnKey}:${e.place}`));
    Tracer.traceBySlice(names.autoSave, (e) => sliceHits.push(`autosave:${e.fnKey}:${e.place}`));

    editor.onTimerScroll();
    api._autoSave();

    expect(sliceHits).toContain("timer:onTimerScroll:before");
    expect(sliceHits).toContain("autosave:_autoSave:before");
  });

  test("common slices: DocLoaded/DocLoading state transition works", () => {
    const names = defineCommonSlicesFromEditorsTracer(nextPrefix());

    const docApi = {
      noop() {
        return 1;
      },
      onDocumentContentReady() {
        return true;
      },
    };
    Tracer.observe(docApi, "asc_docs_api");

    expect(Tracer.tracerState.get(names.docLoading)).toBe(true);
    expect(Tracer.tracerState.get(names.docLoaded)).toBe(false);

    docApi.onDocumentContentReady();

    expect(Tracer.tracerState.get(names.docLoaded)).toBe(true);
    expect(Tracer.tracerState.get(names.docLoading)).toBe(true);
  });

  test("common slices: ClipboardPaste detects CClipboardBase._private_onPaste", () => {
    const names = defineCommonSlicesFromEditorsTracer(nextPrefix());
    const hits = [];
    const clipboard = {
      _private_onPaste() {
        return "ok";
      },
      other() {
        return "x";
      },
    };

    Tracer.observe(clipboard, "CClipboardBase");
    Tracer.traceBySlice(names.clipboardPaste, (e) => hits.push(`${e.fnKey}:${e.place}`));

    clipboard.other();
    clipboard._private_onPaste();

    expect(hits).toEqual(["_private_onPaste:before"]);
  });

  test("word observers scenario: wraps constructors and CEditorPage access", () => {
    const observeConstructor = jest.fn((ctor) => ({ wrappedCtor: ctor }));
    const tracerMock = {
      observePrototypesFromExports: jest.fn(),
      observeFromExports: jest.fn(),
      observeConstructor,
    };

    const win = {
      AscCommonWord: {
        BinaryFileReader: function Reader() {},
        BinaryFileWriter: function Writer() {},
        CEditorPage: function EditorPage() {},
      },
      AscFormat: {},
      AscWord: {},
      Asc: {},
      AscCommon: {},
    };

    runWordObserveFromEditorsTracer(tracerMock, win);
    const pageCtor = win.AscCommonWord.CEditorPage;

    expect(tracerMock.observePrototypesFromExports).toHaveBeenCalledTimes(3);
    expect(tracerMock.observeFromExports).toHaveBeenCalledTimes(3);
    expect(observeConstructor).toHaveBeenCalled();
    expect(pageCtor).toBeDefined();
  });

  test("slide observers scenario: observes clipboard prototype and docs api prototype", () => {
    const tracerMock = {
      observePrototypesFromExports: jest.fn(),
      observeConstructor: jest.fn((ctor) => ({ wrappedCtor: ctor })),
      observe: jest.fn(),
      observePrototype: jest.fn(),
    };

    const base = { marker: 1 };
    const clip = Object.create(base);

    const win = {
      AscCommonWord: {
        BinaryFileReader: function Reader() {},
        BinaryFileWriter: function Writer() {},
      },
      AscFormat: {},
      AscWord: {},
      Asc: { asc_docs_api: function DocsApi() {} },
      AscCommon: { g_clipboardBase: clip },
      AscCommonSlide: {},
    };

    runSlideObserveFromEditorsTracer(tracerMock, win);

    expect(tracerMock.observe).toHaveBeenCalledWith(base, "CClipboardBase");
    expect(tracerMock.observePrototype).toHaveBeenCalledWith(win.Asc.asc_docs_api);
  });
});

