const express = require("express");
const { routeRoot: postRoute } = require("./postController");
const router = express.Router();
const routeRoot = postRoute + "/comments";
const logger = require('../logger')
const model = require("../models/PostCommentModel")
const sessionController = require('./sessionController');
const { isRequesterAdmin } = require('./userController');
const { areUsersIdentical, getSingleUser } = require("../models/UserModel");
const { DatabaseError } = require('../models/DatabaseError')
const { InvalidInputError } = require('../models/InvalidInputError');
require("mongodb");



router.post('/', handleCreatePostComment);
/**
 * Creates a new post comment using parameters from a POST request.
 * @param {Object} request The incoming http request with body containing the comment content and the ID of the post it's commenting on
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 */
async function handleCreatePostComment(request, response) {
    try {
        const currentUser = await sessionController.getAuthenticatedUser(request);
        const content = request.body.content, postId = request.body.postId;

        if (currentUser) {
            const createdPostComment = await model.createPostComment(content, postId, currentUser._id);

            response.send(createdPostComment);
        }
        else
            response.sendStatus(401);
    }
    catch (error) {
        sendError(error, response);
    }
}


router.get('/ids/:postCommentId', handleGetSinglePostComment);
/**
 * Searches for and returns a single post comment using the specified comment ID
 * @param {Object} request The incoming http request with body containing the post comment ID
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 */
async function handleGetSinglePostComment(request, response) {
    try {
        const idToFind = request.params.postCommentId;
        const comment = await model.getSinglePostComment(idToFind);

        logger.info(comment);
        response.send(comment);
    }
    catch (error) {
        sendError(error, response);
    }
}


router.get('/post_ids/:postId', handleGetPostComments)
/**
 * Gets a list of ALL comments for a specific post
 * @param {Object} request The incoming http request. Should have nothing
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 */
async function handleGetPostComments(request, response) {
    try {
        const postId = request.params.postId;
        const postList = await model.getAllPostComments(postId);

        response.send(postList);
    }
    catch (error) {
        sendError(error, response);
    }
}


router.put("/", handleUpdatePost);
/**
 * Updates a user's information if the user exists and sends the updated user object
 * @param {Object} request The incoming http request with the body containing the ID of the post to update as well as the properties to update
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 */
async function handleUpdatePost(request, response) {
    try {
        const postId = request.body.postId;
        const post = await model.getSinglePost(postId);
        const currentUser = await sessionController.getAuthenticatedUser(request);
        const postAuthor = await getSingleUser(null, post.authorId);

        // The person updating the post must be the author
        if (areUsersIdentical(currentUser, postAuthor)) {
            const updatedPost = await model.updatePost(postId, request.body);

            response.send(updatedPost);
        }
        else
            response.sendStatus(401);
    }
    catch(error) {
        sendError(error, response);
    }
}

router.put("/vote", handleVote);
/**
 * 
 * @param {Object} request The incoming http request with the body containing the ID of the post to update as well as the properties to update
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 */
async function handleVote(request, response) {
    try {
        const votingUser = await sessionController.getAuthenticatedUser(request);
        const postId = request.body.postId;
        const vote = request.body.vote;

        await model.votePost(postId, votingUser, vote);
        response.sendStatus(200);
    }
    catch(error) {
        sendError(error, response);
    }
}

router.delete('/', handleDeletePost);

/**
 * Deletes a post from the database and sends the deleted post object
 * @param {Object} request The incoming http request with the body containing the ID of the post to delete
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 */
async function handleDeletePost(request, response) {
    try {
        const postId = request.body.postId;
        const user = await sessionController.getAuthenticatedUser(request);
        const post = await model.getSinglePost(postId), postAuthor = await getSingleUser(null, post.authorId);

        // A user who isn't the post author or an admin should not be allowed to delete
        if (!areUsersIdentical(user, postAuthor) && await isRequesterAdmin(request) == false) {
            response.sendStatus(401);
            return;
        }
            

        const deletedPost = await model.deletePost(postId);
        response.send(deletedPost);
    }
    catch(error) {
        sendError(error, response);
    }
}



// Logs an error, and sends a response of 400 if the error is an InvalidInputError, 500 otherwise
function sendError(error, response) {
    logger.error(error.message);

    if (error instanceof InvalidInputError) {
        response.status(400);
        response.send({ errorMessage: "Invalid Input Error: " + error.message });
    }
    else {
        response.status(500);
        response.send({ errorMessage: "Internal Error: " + error.message });
    }
}

module.exports = { router, routeRoot } //checkCredentials, seedUsers
