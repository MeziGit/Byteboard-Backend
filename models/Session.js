const uuid = require('uuid');
const sessions = [];


// Each session contains the username of the user and the time at which it expires
//  This object can be extended to store additional protected session information
/**
 * Represents a session
 */
class Session {
    constructor(userId, expiresAt) {
        this.userId = userId;
        this.expiresAt = expiresAt;
    }
    // We'll use this method later to determine if the session has expired
    isExpired() {
        this.expiresAt < (new Date())
    }
}

/**
 * Creates a new session using a given username and the minutes until it expires
 * @param {String} username The username to set in the session
 * @param {Number} numMinutes The amount of minutes until the session expires
 * @returns 
 */
function createSession(userId, numMinutes) {
    // Generate a random UUID as the sessionId
    const sessionId = uuid.v4()
    // Set the expiry time as numMinutes (in milliseconds) after the current time
    const expiresAt = new Date(Date.now() + numMinutes * 60000);

    // Create a session object containing information about the user and expiry time
    const thisSession = new Session(userId, expiresAt);

    // Add the session information to the sessions map, using sessionId as the key
    sessions[sessionId] = thisSession;
    return sessionId;
}

function getSession(sessionId) {
    return sessions[sessionId];
}

function deleteSession(sessionId) {
    delete sessions[sessionId];
}



module.exports = { Session, createSession, getSession, deleteSession };

