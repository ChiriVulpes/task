export default function Model(generator) {
    const result = {};
    return {
        get: (...args) => {
            const id = args.map(arg => {
                if (typeof arg === 'object' || typeof arg === 'function')
                    throw new Error('Cannot use model arguments that are not stringify-able');
                return `${arg}`;
            })
                .join(',');
            if (result[id])
                return result[id];
            const promise = result[id] = generator(...args);
            return promise.then(r => result[id] = r);
        },
    };
}
