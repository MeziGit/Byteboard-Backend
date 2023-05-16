class DatabaseError extends Error {
    constructor(message) {
        const err = super(message);
        err.name = 'DatabaseError';
    }
}

module.exports = { DatabaseError }