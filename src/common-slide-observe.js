import { Tracer } from "./logger";

function wrapConstructor(OriginalConstructor, className) {

    if (OriginalConstructor.isPatched === true) {
        return OriginalConstructor;
    }
    
    OriginalConstructor.isPatched = true;

    const result = function(...args) {
        if (new.target) {
            const instance = new OriginalConstructor(...arguments);
            
            Tracer.observe(instance, className || OriginalConstructor.name);

            return instance;
        }

        return OriginalConstructor.apply(this, args);
    };

    result.original = OriginalConstructor;

    return result;
}

export const runObserve = () => {
    Tracer.observePrototypesFromExports(window['AscCommonSlide']);
    Tracer.observePrototypesFromExports(window.AscFormat);
    // Tracer.observeOnSet(window, 'className', Tracer.wrapConstructor)

    window['AscCommonSlide'] = new Proxy(window['AscCommonSlide'], {
        get(target, prop) {
            if (prop === 'CEditorPage' && target[prop]) {

                return wrapConstructor(Reflect.get(target, prop));
            }
            return Reflect.get(target, prop);
        },
        set(target, prop, value) {
            if (prop === 'CEditorPage') {
                value = wrapConstructor(value);
            }
            return Reflect.set(target, prop, value);
        }
    });

    /** !Не менять порядок */

    window['AscCommon'].BinaryPPTYLoader = wrapConstructor(window['AscCommon'].BinaryPPTYLoader);
    window['AscCommon'].CBinaryFileWriter = wrapConstructor(window['AscCommon'].CBinaryFileWriter);

    Tracer
        .observe(Object.getPrototypeOf(window['AscCommon'].g_clipboardBase), 'CClipboardBase')
        .observe(window['AscCommon'].pptx_content_loader.Reader, 'BinaryPPTYLoader')
        .observePrototype(window.AscFormat.CSpPr)
        .observePrototype(window.AscCommon.CDocumentRenderer)
        .observePrototype(window.AscCommon.CShapeDrawer)
        .observePrototype(window.AscCommon.CGraphics)
        .observePrototype(window.AscCommon.baseEditorsApi)
        .observePrototype(window.Asc.asc_docs_api)
        .observe(window['AscCommon'].pptx_content_loader.Reader, 'BinaryPPTYLoader')
        .observe(window['AscCommon'].pptx_content_loader, 'CPPTXContentLoader')
        .observe(window['AscCommon'].pptx_content_writer.BinaryFileWriter, 'CBinaryFileWriter');
}
