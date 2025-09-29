function reactive(obj, callback) {
    return new Proxy(obj, {
        get(target, prop) {
            const value = target[prop];
            if (value && typeof value === 'object') return reactive(value, callback);
            return value;
        },

        set(target, prop, value) {
            target[prop] = value;
            callback(target);
            return true;
        }
    });
}