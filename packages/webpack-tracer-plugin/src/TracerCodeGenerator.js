class TracerCodeGenerator {
    static escapeSingleQuote(value) {
        return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }

    static observeProperty(targetClass, propName, targetExpr = 'this') {
        return `Tracer.observeProperty(${targetExpr}, '${TracerCodeGenerator.escapeSingleQuote(propName)}', '${TracerCodeGenerator.escapeSingleQuote(targetClass)}');`;
    }

    static observePropertyAll(targetClass, propsList, targetExpr = 'this') {
        if (!Array.isArray(propsList) || propsList.length === 0) {
            return '';
        }

        return propsList.map(propName => {
            return TracerCodeGenerator.observeProperty(targetClass, propName, targetExpr);
        }).join('\n\r');
    }

    static observeAllProperties(targetClass, targetExpr = 'this') {
        return `Tracer.observeAllProperties(${targetExpr}, '${TracerCodeGenerator.escapeSingleQuote(targetClass)}');`;
    }

    static observeConstructor(targetClass) {
        return `Tracer.observe(this, '${TracerCodeGenerator.escapeSingleQuote(targetClass)}');`;
    }

    static observePrototype(targetClass) {
        return `Tracer.observePrototype(${targetClass}, '${TracerCodeGenerator.escapeSingleQuote(targetClass)}');`;
    }

    static observePrototypeList(targetList) {
        if (!Array.isArray(targetList) || targetList.length === 0) {
            return '';
        }

        return targetList.map(targetClass => {
            return TracerCodeGenerator.observePrototype(targetClass);
        }).join('\n\r');
    }
}
module.exports = TracerCodeGenerator;
