export default function Model<ARGS extends any[], RETURN>(generator: (...args: ARGS) => Promise<RETURN>): {
    get: (...args: ARGS) => Promise<RETURN> | NonNullable<RETURN>;
};
