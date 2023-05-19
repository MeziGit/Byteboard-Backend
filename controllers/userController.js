const express = require("express");
const router = express.Router();
const routeRoot = "/users";
const validator = require('validator');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const logger = require('../logger')
const model = require("../models/UserModel")
const { DatabaseError } = require('../models/DatabaseError')
const { InvalidInputError } = require('../models/InvalidInputError')
let usersSeededonce = false;
require("mongodb");


/**
 * Returns true if there is a stored user with the same username and password
 * @param {String} username The username that the request sent
 * @param {String} password The password that the request sent (that SHOULD match the password of the user with the same username)
 * @returns True if the credentials are correct, false otherwise
 */
async function areCredentialsCorrect(username, password) {
    try {
        const user = await model.getSingleUser(username)
        const isSame = await bcrypt.compare(password, user.password);

        return isSame
    }
    catch (err) {
        console.error(err.message)
        logger.error(err.message)
        return false
    }
}

/**
 * Checks if a user is an administrator and returns the result
 * @param {Object} request The incoming http request that should contain an admin username and admin password
 * @returns {boolean} True if the user is an admin, false otherwise
 */
async function isRequesterAdmin(request) {
    try {
        const sessionController = require("./sessionController");
        const currentUser = await sessionController.getAuthenticatedUser(request);
        
        if (currentUser)
            return currentUser.admin;
        
        throw new Error("Couldn't verify the user");
    }
    catch(error) {
        logger.error("Error while checking if a user is an admin: " + error);
    }

    return false;
}


router.post("/register", registerUser)
/**
 * Creates a new user account
 * @param {Object} request The incoming http request that should contain a body with the username, email, and password 
 * @param {Object} response The outgoing http response
 */
async function registerUser(request, response) {
    try {
        const username = request.body.username
        const password = request.body.password
        const email = request.body.email


        if(username && password && email)
        {
            await model.createUser(username, email, password);

            logger.info("Successfully registered username " + username);
            response.send({ success: true });
            return;
        }
        else
            throw new InvalidInputError("The username, email, and/or password are not filled in correctly");
    

    } catch (error) {
        sendError(error, response);

    }
}


router.post('/', handleCreateUser);

/**
 * Creates a new user using parameters from a POST request. The requester MUST be an existing administrator
 * @param {Object} request The incoming http request with body containing username, email, and password
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 * @throws InvalidInputError if the user entered invalid credentials
 * @throws DatabaseError if something went wrong in MongoDB
 */
async function handleCreateUser(request, response) {
    try {
        if (await isRequesterAdmin(request)) {
            const username = request.body.username, email = request.body.email, password = request.body.password;
            const createdUser = await model.createUser(username, email, password);

            response.send(createdUser);
        }
        else
            throw new InvalidInputError("Unauthorized access");
    }
    catch (error) {
        sendError(error, response);
    }
}

router.get('/', handleGetUsers)

/**
 * Gets a list of ALL users in the ByteBoard database
 * @param {Object} request The incoming http request. Should have nothing
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 * @throws InvalidInputError if the user entered a username that doesn't exist
 * 
 */
async function handleGetUsers(request, response) {
    try {
        const userList = await model.getAllUsers()
        const publicUserList = userList.map(user => {
            return model.getPublicUserInfo(user);
        })

        response.send(publicUserList);
    }

    catch (error) {
        sendError(error, response);
    }
}


router.get('/usernames/:username', handleGetSingleUserByName)

/**
 * Searches for a user's username in the database and sends this single user if found, but throws errors otherwise. If the requester is not the found user, then it will show only the public details,
 * otherwise it will show all details. 
 * @param {Object} request The incoming http request with the body containing the username only
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 * @returns A single user if found, errors otherwise
 * @throws DatabaseError if something went wrong in MongoDB
 */
async function handleGetSingleUserByName(request, response) {
    try {
        
        const nameToFind = request.params.username;
        if(nameToFind.length == 0) throw new InvalidInputError("User not logged in")
        const user = await model.getSingleUser(nameToFind);
        const infoToSend = (await isRequesterAdmin(request)) ? model.getAllUserInfo(user) : model.getPublicUserInfo(user);

        logger.info(user);
        response.send(infoToSend);
    }
    catch (error) {
        sendError(error, response);
    }
}

router.get('/ids/:userId', handleGetSingleUserById)

/**
 * Searches for a user's ID in the database and sends this single user if found, but throws errors otherwise. If the requester is not the found user, then it will show only the public details,
 * otherwise it will show all details. 
 * @param {Object} request The incoming http request with the body containing the user ID only
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 * @returns A single user if found, errors otherwise
 * @throws DatabaseError if something went wrong in MongoDB
 */
async function handleGetSingleUserById(request, response) {
    try {
        const idToFind = request.params.userId;
        const user = await model.getSingleUser(null, idToFind);
        const infoToSend = (await isRequesterAdmin(request)) ? model.getAllUserInfo(user) : model.getPublicUserInfo(user);

        logger.info(user);
        response.send(infoToSend);
    }
    catch (error) {
        sendError(error, response);
    }
}


router.put("/", handleUpdateUser);

/**
 * Updates a user's information if the user exists and sends the updated user object
 * @param {Object} request The incoming http request with the body containing the username to update as well as the properties to update
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 * @throws InvalidInputError if the password of the sender is not the same as the password of the user with the username to update
 */
async function handleUpdateUser(request, response) {
    try {
        const sessionController = require("./sessionController");
        const user = await sessionController.getAuthenticatedUser(request);
        const nameToUpdate= user.username;

        if(request.body.email != null || request.body.password != null || request.body.username != null)
        {
            if (!await areCredentialsCorrect(nameToUpdate, request.body.currentPassword)) 
            throw new InvalidInputError("Your password is incorrect");
        }


        if (request.body.reputation != null) {
            // We don't want someone to be able to set their rep because that's cheating
            request.body.reputation = null;
        }

        const updatedUser = await model.updateUser(nameToUpdate, request.body);
        response.send(updatedUser);
    }
    catch (error) {
        sendError(error, response);
    }
}


router.delete('/', handleDeleteUser);

/**
 * Delete's a user from the database and sends the deleted user object
 * @param {Object} request The incoming http request with the body containing the username to delete
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 */
async function handleDeleteUser(request, response) {
    try {
        const sessionController = require("./sessionController");
        const user = await sessionController.getAuthenticatedUser(request);
        const nameToDelete = user.username;

        if (!await areCredentialsCorrect(nameToDelete, request.body.currentPassword)) 
            throw new InvalidInputError("Your password is incorrect");

        // Log out the user that's about to be deleted
        sessionController.logoutUser(request, response, false);
        const deletedUser = await model.deleteUser(nameToDelete);


        response.send(deletedUser);
    }
    catch (error) {
        sendError(error, response);
    }
}

router.delete('/delete/:user', handleDeleteUserAdmin);

async function handleDeleteUserAdmin(request, response) {
    try {
        const sessionController = require("./sessionController");
        const user = await sessionController.getAuthenticatedUser(request);
        const nameToDelete = request.params.user

        if (user.username != "admin") 
            throw new InvalidInputError("You cant delete that");


        const deletedUser = await model.deleteUser(nameToDelete);


        response.send(deletedUser);
    }
    catch (error) {
        sendError(error, response);
    }
}




// Logs an error, and sends a response of 400 if the error is an InvalidInputError, 500 otherwise
function sendError(error, response) {
    logger.error(error.message);

    if (error instanceof InvalidInputError) {
        response.status(400);
        response.send({ errorMessage:  error.message });
    }
    else {
        response.status(500);
        response.send({ errorMessage: "Internal Error: " + error.message });
    }
}

module.exports = { checkCredentials: areCredentialsCorrect, isRequesterAdmin, router, routeRoot,sendError }
