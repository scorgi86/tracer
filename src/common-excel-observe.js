import { Tracer } from './logger.js';

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

// Tracer.observePrototypeFromExportAll(window['AscCommonWord']);
// Tracer.observePrototypeFromExportAll(window.AscFormat);

window['AscCommonWord'] = new Proxy(window['AscCommonWord'], {
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

window["AscCommonWord"].BinaryFileReader = wrapConstructor(window['AscCommonWord'].BinaryFileReader);
window["AscCommonWord"].BinaryFileWriter = wrapConstructor(window['AscCommonWord'].BinaryFileWriter);

// Tracer.observePrototype(AscCommon.CDocumentRenderer);
// Tracer.observePrototype(AscCommon.CShapeDrawer);
// Tracer.observePrototype(AscCommon.CGraphics);
Tracer.observePrototype(window.AscCommon.baseEditorsApi);
Tracer.observePrototype(window.Asc.spreadsheet_api);

