const InjectLoader = require('./InjectLoader');


let injectLoaderInstance;

/**
 * 
 * @param {string} sourceCode код модуля
 * @returns
 */
module.exports = function(sourceCode) {
    if (!injectLoaderInstance) {
        injectLoaderInstance = new InjectLoader(this.getOptions());
    }
    
    return injectLoaderInstance.processCode(sourceCode);
}