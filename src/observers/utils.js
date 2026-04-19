export const isUpperCase = (char) => {
    if (typeof char !== 'string' || char.length !== 1) {
        return false;
    }
    
    const code = char.charCodeAt(0);
    // A-Z: 65-90, А-Я: 1040-1071, Ё: 1025
    return (code >= 65 && code <= 90) || 
        (code >= 1040 && code <= 1071) || 
        code === 1025;
}

export const isClassNameLike = (key) => key[0] === 'C' && isUpperCase(key[1]);

export const isClassLike = (key, obj) => {
    return isClassNameLike(key) || Object.keys(obj[key]?.prototype || {})?.length > 0
};

export const traverseAll = (list, callback) => {
    list.map(callback);
}