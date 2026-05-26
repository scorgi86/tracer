export class Node {
    prev;
    next;
    val;
    _prevTraceStack;

    constructor(val = null, prev = null, next = null) {
        this.prev = prev;
        this.next = next;
        this.val = val;
        this._prevTraceStack = [];
    }

    isContain(callback) {
        let result = false;
        this.forEach((item) => {
            result = callback(item.val);

            /** Если найден => оставить проход на текущем элементе */
            if (result) {
                return false;
            }
        });

        return result;
    }

    forEach(callback) {
        let currentNode = this;

        while(currentNode) {

            const result = callback(currentNode);
            if (result === false) {
                return;
            }
            currentNode = currentNode.prev;
        }
    }

    trace(...values) {
        const stack = [];
        const log = [];

        this.forEach((item) => {
            stack.push(item);
        });

        let spaces = '';
        for(let i = stack.length - 1; i > -1; i--) {
            if (stack[i].val) {
                const { fnKey, className } = stack[i].val;
                const logValue = `${spaces}${className}.${fnKey}`;
                log.push(logValue);
                spaces += ' ';
            }
        }

        console.log(log.join('\n\r\t'));

        if (values.length) {
            values.forEach((value) => {
                console.log(spaces + JSON.stringify(value));
            });
        }

        return this;
    }
}

export class ExecutionContext {

    static rootContext = new Node;
    static _mode = "stack";
    static _provider = {
        currentContext: ExecutionContext.rootContext,
        withContext(data, fn) {
            const rootContext = this.currentContext;
            const newCurrentContext = new Node(data, this.currentContext, null);
            this.currentContext = newCurrentContext;
            rootContext.next = this.currentContext;

            try {
                return fn();
            } finally {
                if (this.currentContext !== ExecutionContext.rootContext) {
                    this.currentContext = this.currentContext.prev;
                    this.currentContext.next = null;
                }
            }
        },
        getCurrentContext() {
            return this.currentContext;
        }
    };

    static _zoneContextKey = "__tracer_context";

    static configure(options = {}) {
        const mode = options.asyncContext || options.mode || "stack";

        if (mode === "zone") {
            const zoneRef = globalThis.Zone;
            if (!zoneRef || !zoneRef.current || typeof zoneRef.current.fork !== "function") {
                throw new Error("Zone.js не найден. Подключите zone.js перед включением asyncContext='zone'");
            }

            ExecutionContext._mode = "zone";
            ExecutionContext._provider = {
                withContext(data, fn) {
                    const prevContext = this.getCurrentContext();
                    const newCurrentContext = new Node(data, prevContext, null);
                    prevContext.next = newCurrentContext;
                    const zoneRefInner = globalThis.Zone;
                    const zone = zoneRefInner.current.fork({
                        name: "tracer-context",
                        properties: {
                            [ExecutionContext._zoneContextKey]: newCurrentContext,
                        },
                    });
                    return zone.run(fn);
                },
                getCurrentContext() {
                    const zoneRefInner = globalThis.Zone;
                    if (!zoneRefInner || !zoneRefInner.current || typeof zoneRefInner.current.get !== "function") {
                        return ExecutionContext.rootContext;
                    }
                    return (
                        zoneRefInner.current.get(ExecutionContext._zoneContextKey) ||
                        ExecutionContext.rootContext
                    );
                },
            };
            return;
        }

        ExecutionContext._mode = "stack";
        ExecutionContext._provider = {
            currentContext: ExecutionContext.rootContext,
            withContext(data, fn) {
                const rootContext = this.currentContext;
                const newCurrentContext = new Node(data, this.currentContext, null);
                this.currentContext = newCurrentContext;
                rootContext.next = this.currentContext;

                try {
                    return fn();
                } finally {
                    if (this.currentContext !== ExecutionContext.rootContext) {
                        this.currentContext = this.currentContext.prev;
                        this.currentContext.next = null;
                    }
                }
            },
            getCurrentContext() {
                return this.currentContext;
            }
        };
    }

    static getMode() {
        return ExecutionContext._mode;
    }

    static withContext(data, fn) {
        return ExecutionContext._provider.withContext(data, fn);
    }

    static getCurrentContext = () => {
        return ExecutionContext._provider.getCurrentContext();
    }
}
