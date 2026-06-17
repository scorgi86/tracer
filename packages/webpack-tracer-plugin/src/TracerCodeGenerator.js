class TracerCodeGenerator {
    static escapeSingleQuote(value) {
        return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }

    static quoteString(value) {
        return `'${TracerCodeGenerator.escapeSingleQuote(value)}'`;
    }

    static observeProperties(targetClass, properties = true, targetExpr = 'this') {
        const className = TracerCodeGenerator.quoteString(targetClass);
        const propertiesCode = Array.isArray(properties)
            ? `[${properties.map((propName) => TracerCodeGenerator.quoteString(propName)).join(', ')}]`
            : properties === true
                ? 'true'
                : TracerCodeGenerator.quoteString(properties);

        return `Tracer.observeProperties(${targetExpr}, { name: ${className}, properties: ${propertiesCode} });`;
    }

    static observePropertiesList(targetClass, propsList, targetExpr = 'this') {
        if (!Array.isArray(propsList) || propsList.length === 0) {
            return '';
        }

        return TracerCodeGenerator.observeProperties(targetClass, propsList, targetExpr);
    }

    static observePropertiesAll(targetClass, targetExpr = 'this') {
        return TracerCodeGenerator.observeProperties(targetClass, true, targetExpr);
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
