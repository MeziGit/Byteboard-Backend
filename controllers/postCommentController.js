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
            throw new InvalidInputError("User not logged in")
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


router.put("/", handleUpdatePostComment);
/**
 * Updates a user's information if the user exists and sends the updated user object
 * @param {Object} request The incoming http request with the body containing the ID of the post comment to update as well as the properties to update
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 */
async function handleUpdatePostComment(request, response) {
    try {
        const postCommentId = request.body.postCommentId;
        const comment = await model.getSinglePostComment(postCommentId);
        const currentUser = await sessionController.getAuthenticatedUser(request);
        const commentAuthor = await getSingleUser(null, comment.authorId);

        // The person updating the post comment must be the author
        if (areUsersIdentical(currentUser, commentAuthor) || isRequesterAdmin(currentUser)) {
            const updatedComment = await model.updatePostComment(postCommentId, request.body);

            response.send(updatedComment);
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
 * Alters to a post comment's score based on a user's vote
 * @param {Object} request The incoming http request with the body containing the ID of the post to update as well as the properties to update
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 */
async function handleVote(request, response) {
    try {
        const votingUser = await sessionController.getAuthenticatedUser(request);
        const postCommentId = request.body.postCommentId;
        const vote = request.body.vote;

        await model.votePost(postCommentId, votingUser, vote);
        response.sendStatus(200);
    }
    catch(error) {
        sendError(error, response);
    }
}

router.delete('/', handleDeletePost);

/**
 * Deletes a post from the database and sends the deleted post comment object
 * @param {Object} request The incoming http request with the body containing the ID of the post comment to delete
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 */
async function handleDeletePost(request, response) {
    try {
        const postCommentId = request.body.postCommentId;
        const user = await sessionController.getAuthenticatedUser(request);
        const comment = await model.getSinglePostComment(postCommentId), postAuthor = await getSingleUser(null, comment.authorId);

        // A user who isn't the post author or an admin should not be allowed to delete
        if (!areUsersIdentical(user, postAuthor) && await isRequesterAdmin(request) == false) {
            response.sendStatus(401);
            return;
        }
            

        const deletedComment = await model.deletePostComment(postCommentId);
        response.send(deletedComment);
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
        response.send({ errorMessage:  error.message });
    }
    else {
        response.status(500);
        response.send({ errorMessage: "Internal Error: " + error.message });
    }
}

module.exports = { router, routeRoot } //checkCredentials, seedUsers
