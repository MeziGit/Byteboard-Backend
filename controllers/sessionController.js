const express = require("express");
const { Session, createSession, getSession, deleteSession, } = require("../models/Session")
const { checkCredentials, sendError } = require("./userController");
const userModel = require("../models/UserModel");

const router = express.Router();
const routeRoot = "/session";
const logger = require('../logger');
const { InvalidInputError } = require("../models/InvalidInputError");


router.get('/logout', logoutUser);

/**
 * Logs out the currently logged in user
 * @param {Object} request The incoming http request
 * @param {Object} response The outgoing http response
 * @param {Boolean} isSendingStatus If true, then a status code will be sent. Is true by default
 * @returns 
 */
async function logoutUser(request, response, isSendingStatus = true) {
    try {
        const authenticatedSession = authenticateUser(request);
        if (!authenticatedSession) {
            response.sendStatus(401); // Unauthorized access
            return;
        }

        const user = await getUserFromId(authenticatedSession.userSession.userId);
        deleteSession(authenticatedSession.sessionId)


        logger.info("Logged out user " + user.username);
        // "erase" cookie by forcing it to expire.
        response.cookie("sessionId", "", { expires: new Date(), httpOnly: true });
        //response.redirect('/');

        if (isSendingStatus)
            response.sendStatus(200);
    }
    catch (error) {
        logger.error(error);
        response.sendStatus(500);
    }
};



router.post("/login", loginUser);

/** Log a user in and create a session cookie that will expire in 2 minutes */
async function loginUser(request, response) {
    try {


        // Checks if the user is already logged in, and will send a 401 status if so
        const authenticatedSession = authenticateUser(request);
        if (authenticatedSession) {
            throw new InvalidInputError("You are already logged in, log out to log in on another account"); // Unauthorized access
            return;
        }

        // Let's assume successful login for now with placeholder username
        const username = request.body.username
        const password = request.body.password

        if (username && password) {
            if (await checkCredentials(username, password)) {
                const user = await userModel.getSingleUser(username);
                logger.info("Successful login for user " + username)

                const sessionId = createSession(user._id, 30);

                response.cookie("sessionId", sessionId, { expires: getSession(sessionId).expiresAt, httpOnly: true })
                response.send("successful login for user " + username);
                return;

            }
            else {
                throw new InvalidInputError("Unsuccessful login: Invalid username / password given for user: " + username)
            }

        }
        else {

            throw new InvalidInputError("Unsuccessful login: empty username or password given")
        }
    }
    catch (error) {
        sendError(error, response)
    }

};


/**
 * Checks if a request has a sessionId cookie and is not expired. Returns an object containing the sessionId and user session if the aforementioned criteria is met and null otherwise.
 * @param {Object} request The incoming http request that should contain a sessionId cookie
 * @returns Returns an object containing the sessionId and user session if the http request contains a sessionId cookie that isn't expired. Returns null otherwise.
 */
function authenticateUser(request) {
    // If this request doesn't have any cookies, that means it isn't authenticated. Return null.
    if (!request.cookies) {
        return null;
    }
    // We can obtain the session token from the requests cookies, which come with every request
    const sessionId = request.cookies['sessionId']
    if (!sessionId) {
        // If the cookie is not set, return null
        return null;
    }
    // We then get the session of the user from our session map
    userSession = getSession(sessionId);
    if (!userSession) {
        return null;
    }// If the session has expired, delete the session from our map and return null
    if (userSession.isExpired()) {
        deleteSession(sessionId);
        return null;
    }
    return { sessionId, userSession }; // Successfully validated.
}



router.get("/getUsername", handleGetUsername)
/**
 * Gets a username if the 
 * @param {Object} request The incoming http request
 * @param {Object} response The outgoing http response
 */
async function handleGetUsername(request, response) {
    try {
        const user = await getAuthenticatedUser(request);
        response.send({username: user.username});
    }
    catch (err) {
        sendError(err, response);
    }
}

router.get("/getSelf", handleGetSelf)
/**
 * Gets a username if the 
 * @param {Object} request The incoming http request
 * @param {Object} response The outgoing http response
 */
async function handleGetSelf(request, response) {
    try {
        const user = await getAuthenticatedUser(request);
        response.send(user);
    }
    catch (err) {
        sendError(err, response);
    }
}

/**
 * 
 * @param {Object} request The incoming http request
 * @returns A username
 */
async function getAuthenticatedUser(request) {
    try {
        const authenticatedSession = authenticateUser(request);
        if (!authenticatedSession) {
            logger.error("Not allowed to get user, as there is no authenticated session");
            throw new InvalidInputError("You are not logged in!");
        }

        const user = await getUserFromId(authenticatedSession.userSession.userId);
        return user;
    }
    catch (err) {
        throw err;
    }
}



function refreshSession(request, response) {
    const authenticatedSession = authenticateUser(request);
    if (!authenticatedSession) {
        response.sendStatus(401); // Unauthorized access
        return;
    }
    // Create and store a new Session object that will expire in 2 minutes.
    const newSessionId = createSession(authenticatedSession.userSession.userId, 2);
    // Delete the old entry in the session map 
    deleteSession(authenticatedSession.sessionId);

    // Set the session cookie to the new id we generated, with a
    // renewed expiration time
    response.cookie("sessionId", newSessionId, { expires: getSession(newSessionId).expiresAt, httpOnly: true })
    return newSessionId;
}

async function getUserFromId(userId) {
    const user = await userModel.getSingleUser(null, userId);
    return user;
}


module.exports = { router, routeRoot, loginUser, logoutUser, authenticateUser, getAuthenticatedUser, refreshSession };


