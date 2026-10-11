const originalEmit = process.emit;
process.emit = function(event, error, ...args) {
    if ('warning' === event && 'ExperimentalWarning' === error.name) return false;
    return Reflect.apply(originalEmit, this, [
        event,
        error,
        ...args
    ]);
};
