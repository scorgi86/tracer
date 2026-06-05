/**
 * Класс реализует паттерн pub/sub.
 */
export class PubSub {
    
    constructor() {
        this._events = new Map;
        this._throwSubscriberErrors = true;
        this._onSubscriberError = null;
    }

    notify(eventName, ...args) {
        const callbacks = this._events.get(eventName);

        if (!callbacks?.length) {
            return;
        }

        for (let i = 0; i < callbacks.length; i += 1) {
            try {
                callbacks[i](...args);
            } catch (error) {
                if (typeof this._onSubscriberError === "function") {
                    try {
                        this._onSubscriberError({
                            eventName,
                            error,
                            callback: callbacks[i],
                            callbackIndex: i,
                            args,
                        });
                    } catch (_) {
                        // Ignore observer handler failures to preserve original failure behavior.
                    }
                }

                if (this._throwSubscriberErrors) {
                    throw error;
                }
            }
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

    setSubscriberErrorPolicy = ({
        throwSubscriberErrors = true,
        onSubscriberError = null,
    } = {}) => {
        this._throwSubscriberErrors = throwSubscriberErrors !== false;
        this._onSubscriberError = typeof onSubscriberError === "function"
            ? onSubscriberError
            : null;
    }

    unSubscribeAll(eventName) {
        const eventsMap = this._events.get(eventName);
        if (eventsMap) {
            this._events.set(eventName, []);
        }
    }
}
