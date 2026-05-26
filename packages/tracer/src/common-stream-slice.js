import { Tracer } from "./logger.js";

const isX2tRunning = () => typeof EventTarget === 'undefined';

export const AppTimerTickSlice = () =>
    Tracer.defineSlice('AppTimerTick', {
        description: `Если true => отрабатывает глобальный таймер проверки и сохранения нового состояния,
            после которого вызовется перерисовка`,
        predicate: ({ fnKey, className }) => {
            return className.indexOf('CEditorPage') > -1 && fnKey === 'onTimerScroll';
        },
        beforeCall: () => true,
        afterCall: () => false
    });

export const AutoSaveTickSlice = () =>
    Tracer.defineSlice('AutoSaveTick', {
        description: `Если true => вызван глобальный таймер автосохранения
            из setInterval в baseEditorsApi.prototype.onDocumentContentReady`,
        predicate: ({ fnKey, className, tracerState }) => {
            return tracerState.get('AppTimerTick') === false && className.indexOf('baseEditorsApi') > -1 && fnKey === '_autoSave';
        },
        beforeCall: () => true,
        afterCall: () => false
    });

export const AnimationSlice = () =>    
    Tracer.defineSlice('Animation', {
        initial: false,
        description: 'Фиксирует состояние - выполняется колбеки в reacuestAnimationFrame',
        predicate: ({ fnKey, className }) => fnKey === '_animation' && className === 'PaintMessageLoop',
        beforeCall: () => true,
        afterCall: () => false
    });

export const UserActionSlice = () =>
    Tracer
        .defineSlice('UserAction', {
            /** В интерфейсе показать наследника, если он есть */
            description: `Фиксирует состояние - действие пользователя(реация на дом события)`,
            predicate: ({ tracerState }) => {
                return tracerState.get('DocLoaded') && tracerState.get('AppTimerTick') === false &&
                    tracerState.get('AutoSaveTick') === false && tracerState.get('Animation') === false;
            },
            beforeCall: () => {
                return true;
            },
            afterCall: () => {
                return false;
            }
        });

export const DocSavingStart = () => 
    Tracer.defineSlice('DocSavingStart', {
        initial: false,
        description: 'Фиксирует состояние - пользовать запустил сохранение документа',
        predicate: ({ fnKey }) => {
            return fnKey === 'DesktopOfflineAppDocumentStartSave' || fnKey === 'DesktopOfflineAppDocumentEndSave';
        },
        beforeCall: ({ fnKey }) => {
            return fnKey === 'DesktopOfflineAppDocumentStartSave';
        },
        afterCall: ({ fnKey }) => {
            return fnKey === 'DesktopOfflineAppDocumentEndSave';
        },
    });

export const DocLoadedSlice = () =>
    Tracer.defineSlice('DocLoaded', {
        initial: false,
        description: 'Фиксирует состояние - документ инициализирован',
        predicate: (args) => {
            return args.fnKey === 'onDocumentContentReady';
        },
        beforeCall: () => false,
        afterCall: () => true,
    });

export const DocLoadingSlice = () =>
    Tracer.defineSlice('DocLoading', {
        initial: true,
        description: 'Фиксирует состояние - документ инициализируется',
        predicate: (args) => {
            return args.tracerState.get('DocLoaded') !== true;
        },
        beforeCall: (args) => args.tracerState.get('DocLoaded') !== true,
        afterCall: (args) => {
            const result = args.tracerState.get('DocLoaded') === true;

            return result;
        },
    });

export const LoadDocumentSlice = () =>
    Tracer.defineSlice('LoadDocument', {
        description: 'Фиксирует состояние - документ читает бинарные данные',
        predicate: (args) => {
            return args.fnKey === 'LoadDocument' && args.className === 'BinaryPPTYLoader';
        },
        beforeCall: () => true,
        afterCall: () => {
            Tracer.untraceBySlice('LoadDocument');
            return false;
        }
    });

export const WriteDocumentSlice = () => {
    Tracer.defineSlice('WriteDocument', {
        description: 'Фиксирует состояние - документ читает бинарные данные',
        predicate: (args) => {
            return args.className === 'CPPTXContentWriter' || args.className === 'CBinaryFileWriter';
        },
        beforeCall: () => true,
        afterCall: () => {
            Tracer.untraceBySlice('LoadDocument');
            return false;
        }
    });
}

export const OpenDocumentFromBinSlice = () => 
    Tracer.defineSlice('OpenDocumentFromBin', {
        description: 'Фиксирует состояние - документ читает бинарные данные',
        predicate: (args) => {
            return args.fnKey === 'OpenDocumentFromBin' && args.className === 'asc_docs_api';
        },
        beforeCall: () => true,
        afterCall: () => {
            Tracer.untraceBySlice('OpenDocumentFromBin');
            return false;
        }
    });

export const DefaultStylesCreatedSlice = () =>
    Tracer.defineSlice('default-styles-created', {
        description: 'Фиксирует состояние - создаются стили по умолчанию',
        predicate: (args) => {
            return args.className === 'CPresentation' && args.fnKey === 'createDefaultTableStyles';
        },
        beforeCall: () => {
            return false;
        },
        afterCall: () => {
            return true;
        }
    });

export const X2tSlice = () => {
    if (isX2tRunning()) {
        Tracer.tracerState.set('x2t', true);
        console.log('Документ построен в контексте x2t');
    }
}

export const runAll = () => {
    AppTimerTickSlice();
    AutoSaveTickSlice();
    AnimationSlice();
    UserActionSlice();
    DocSavingStart();
    DocLoadedSlice();
    DocLoadingSlice();
    LoadDocumentSlice();
    WriteDocumentSlice()
    OpenDocumentFromBinSlice();
    DefaultStylesCreatedSlice();
    X2tSlice();
}
