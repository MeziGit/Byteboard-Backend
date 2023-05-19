const express = require("express");
const router = express.Router();
const routeRoot = "/posts";
const logger = require('../logger')
const model = require("../models/PostModel")
const sessionController = require('./sessionController');
const { isRequesterAdmin } = require('./userController');
const { areUsersIdentical, getSingleUser } = require("../models/UserModel");
const { DatabaseError } = require('../models/DatabaseError')
const { InvalidInputError } = require('../models/InvalidInputError');
require("mongodb");



router.post('/', handleCreatePost);
/**
 * Creates a new post using parameters from a POST request.
 * @param {Object} request The incoming http request with body containing the post title, description, topic name, and author name
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 */
async function handleCreatePost(request, response) {
    try {
        const currentUser = await sessionController.getAuthenticatedUser(request);
        const title = request.body.title, content = request.body.content, topicNames = request.body.topicNames;

        if(title == null || content == null)
        {
            throw new InvalidInputError("Title or Content is empty")
        }
        if (currentUser) {
            const createdPost = await model.createPost(title, content, topicNames, currentUser._id);

            response.send(createdPost);
        }
        else
            response.sendStatus(401);
    }
    catch (error) {
        sendError(error, response);
    }
}


router.get("/topics", handleGetPostTopics);
/**
 * Gets a list of all post topics available
 * @param {Object} request The incoming http request. Should have nothing
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 */
async function handleGetPostTopics(request, response) {
    try {
        let topicList = await model.getAllPostTopics();
        response.send(topicList);
    }

    catch (error) {
        sendError(error, response);
    }
}


router.get('/ids/:postId', handleGetSinglePost);

/**
 * Searches for and returns a single post using the specified post ID
 * @param {Object} request The incoming http request with body containing the post ID
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 */
async function handleGetSinglePost(request, response) {
    try {
        const idToFind = request.params.postId;
        const post = await model.getSinglePost(idToFind);

        logger.info(post);
        response.send(post);
    }
    catch (error) {
        sendError(error, response);
    }
}

router.get("/users/:userId", handleGetPostsFromUser);
/**
 * Gets all posts created by the given user and sends them as an array
 * @param {Object} request The incoming http request with body containing the user's ID
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 */
async function handleGetPostsFromUser(request, response) {
    try{
        const userId = request.params.userId;
        const allPostsFromUser = await model.getAllPostsFromUser(userId);

        response.send(allPostsFromUser);
    }
    catch (error) {
        sendError(error, response);
    }
}


router.get('/', handleGetPosts)
/**
 * Gets a list of ALL posts in the ByteBoard database
 * @param {Object} request The incoming http request. Should have nothing
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 */
async function handleGetPosts(request, response) {
    try {
        let postList = await model.getAllPosts();
        response.send(postList);
    }

    catch (error) {
        sendError(error, response);
    }
}

router.get('/jobs', handleGetJobPosts)
/**
 * Gets a list of ALL job posts in the ByteBoard database
 * @param {Object} request The incoming http request. Should have nothing
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 */
async function handleGetJobPosts(request, response) {
    try {
        let postList = await model.getAllJobPosts();
        response.send(postList);
    }

    catch (error) {
        sendError(error, response);
    }
}


router.put("/", handleUpdatePost);
/**
 * Updates a post's information if the user exists and sends the updated user object
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
        if (areUsersIdentical(currentUser, postAuthor) || isRequesterAdmin(currentUser)) {
            const updatedPost = await model.updatePost(postId, request.body, true);

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
 * Sets a post's score and the post author's reputation to a new value depending on the vote
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
        response.send({ errorMessage: error.message });
    }
    else {
        response.status(500);
        response.send({ errorMessage: "Internal Error: " + error.message });
    }
}

module.exports = { router, routeRoot } //checkCredentials, seedUsers
