/**
 * Класс реализует паттерн pub/sub.
 */
export class PubSub {
    
    constructor() {
        this._events = new Map;
    }

    notify(eventName, ...args) {
        const callbacks = this._events.get(eventName);

        if (!callbacks?.length) {
            return;
        }

        for (let i = 0; i < callbacks.length; i += 1) {
            callbacks[i](...args);
        }
    }

    subscribe = (eventName, callback) => {
        if (!this._events.has(eventName)) {
            this._events.set(eventName, []);    
        }

        this._events.get(eventName).push(callback);
    }

    unSubscribe = (eventName, callback) => {
        const callbacks = this._events.get(eventName);

        if (callbacks) {
            this._events.set(eventName, callbacks.filter(cb => cb !== callback));
        }
    }

    has = (eventName) => {
        const callbacks = this._events.get(eventName);
        return !!(callbacks && callbacks.length);
    }

    unSubscribeAll(eventName) {
        const eventsMap = this._events.get(eventName);
        if (eventsMap) {
            this._events.set(eventName, []);
        }
    }
}
