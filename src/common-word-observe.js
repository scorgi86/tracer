import { Tracer } from './index.js';

function wrapConstructor(OriginalConstructor, className) {

    if (OriginalConstructor.isPatched === true) {
        return OriginalConstructor;
    }
    
    OriginalConstructor.isPatched = true;

    return function(...args) {
        if (new.target) {
            const instance = new OriginalConstructor(...arguments);
            
            Tracer.observe(instance, className || OriginalConstructor.name);

            return instance;
        }

        return OriginalConstructor.apply(this, args);
    };
}

export const runObserve = () => {
    Tracer.observePrototypeFromExportAll(window['AscCommonWord']);
    Tracer.observePrototypeFromExportAll(window.AscFormat);
    Tracer.observePrototypeFromExportAll(window.AscWord);

    window['AscCommonWord'] = new Proxy(window['AscCommonWord'], {
        get(target, prop) {
            if (prop === 'CEditorPage' && target[prop]) {

                return Tracer.observeConstructor(Reflect.get(target, prop));
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

    window["AscCommonWord"].BinaryFileReader = wrapConstructor(window['AscCommonWord'].BinaryFileReader);
    window["AscCommonWord"].BinaryFileWriter = wrapConstructor(window['AscCommonWord'].BinaryFileWriter);

    Tracer.observeFromExportAll(window.Asc);
    Tracer.observeFromExportAll(window.AscCommonWord);

    Tracer
        .observe(Object.getPrototypeOf(window['AscCommon'].g_clipboardBase), 'CClipboardBase')
        .observePrototype(window.AscCommon.CDocumentRenderer)
        .observePrototype(window.AscCommon.CShapeDrawer)
        .observePrototype(window.AscCommon.CGraphics)
        .observePrototype(window.AscCommon.baseEditorsApi)
        .observePrototype(window.Asc.asc_docs_api);

}