class BaseReport {
  
  logProvider = null;
  constructor({ logProvider }) {
    this.logProvider = logProvider;
  }

  log() {

  }
}

/**
 * Отчет создат
 */
class ReportUsage {
  static description =
    "Отчет соберет информацию использованных классах и вызовах их метотдов";

  _store;
  logProvider;

  constructor({ logProvider = console }) {
    this._store = new Map();
    this.logProvider = logProvider;
  }
  
  log(args) {

    if (!this._store.has(args.className)) {
      this._store.set(args.className, new Set);
    }

    if (this._store.get(args.className).has(args.fnKey) === false) {
      this._store.get(args.className).add(args.fnKey);
    }
  }

  print() {
    let classStack = [];
    let methodsStack = [];

    this._store.forEach((valueSet, key) => {
      classStack.push(key);
      valueSet.forEach((method) => {
        methodsStack.push(`Class: ${key}.${method}`);
      })
    });
    this.logProvider.log(classStack.join('\n\t\r'));
    this.logProvider.log(methodsStack.join('\n\t\r'));
  }
}

class ReportTreeView {
  _stack;

  constructor() {
    this._stack = [];
    this._result = [];
  }

  log(args, serializedValues) {
    const { eventType, className, fnKey, propName } = args;
    const fullKey = `${className}.${fnKey || propName}`;

     if (eventType === "propertySet") {

      this._result.push(`${this._stack.join("")} ${fullKey} - ${serializedValues || "none values"}`);
    } else if (eventType === 'functionCall') {
      
      if (args.place === "before") {
        const newLogItem = `${this._stack.join("")} ${fullKey} - ${serializedValues || "none values"}`;
        this._result.push(newLogItem);
        
        console.log(newLogItem);

        this._stack.push("	");

      } else if (args.place === "after") {
        this._stack.pop();
      }
    }
  }

  getResults() {
    return this._result;
  }
}

class ReportSimple {
  _store;
  constructor({ logProvider }) {
    this._store = new Set();
    this.logProvider = logProvider;
  }

  log({ fnKey, className }) {
    const fullKey = `${className}.${fnKey}`;

    this.logProvider.log(fullKey);
    this._store.add(fullKey);
  }
}


module.exports = {
  ReportUsage,
  ReportTreeView,
  ReportSimple
};