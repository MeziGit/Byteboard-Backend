class InvalidInputError extends Error {
    constructor(message) {
        const error = super(message);
        error.name = 'InvalidInputError';
    }
}
module.exports = { InvalidInputError }