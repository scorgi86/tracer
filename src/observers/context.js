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

    static currentContext = ExecutionContext.rootContext;

    static pushContext(data) {
        const rootContext = ExecutionContext.currentContext;
        const newCurrentContext = new Node(data, ExecutionContext.currentContext, null);

        ExecutionContext.currentContext = newCurrentContext;

        rootContext.next = ExecutionContext.currentContext;
    };

    static popContext = () => {
        const { currentContext, rootContext } = ExecutionContext;

        if (currentContext === rootContext) {
            throw new Error("Cannot pop root context");
        }
        ExecutionContext.currentContext = ExecutionContext.currentContext.prev;
        ExecutionContext.currentContext.next = null;
    }

    static getCurrentContext = () => {
        return ExecutionContext.currentContext;
    }
}