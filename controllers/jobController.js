const express = require("express");
const router = express.Router();
const routeRoot = "/jobs";
const logger = require('../logger')
const model = require("../models/JobModel")
const sessionController = require('./sessionController');
const { isRequesterAdmin } = require('./userController');
const { areUsersIdentical, getSingleUser } = require("../models/UserModel");
const { DatabaseError } = require('../models/DatabaseError')
const { InvalidInputError } = require('../models/InvalidInputError');
require("mongodb");



router.post('/', handleCreateJob);
/**
 * Creates a new job using parameters from a POST request.
 * @param {Object} request The incoming http request with body containing the post title, description, and job pay
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 */
async function handleCreateJob(request, response) {
    try {
        const currentUser = await sessionController.getAuthenticatedUser(request);
        const title = request.body.title, description = request.body.description, jobPay = request.body.jobPay;

        if (currentUser) {
            const createdJob = await model.createJob(title, description, jobPay, currentUser._id);

            response.send(createdJob);
        }
        else
            response.sendStatus(401);
    }
    catch (error) {
        sendError(error, response);
    }
}


router.get('/ids/:jobId', handleGetSingleJob);

/**
 * Searches for and returns a single post using the specified post ID
 * @param {Object} request The incoming http request with body containing the post ID
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 */
async function handleGetSingleJob(request, response) {
    try {
        const idToFind = request.params.jobId;
        const job = await model.getSingleJob(idToFind);

        logger.info(job);
        response.send(job);
    }
    catch (error) {
        sendError(error, response);
    }
}

router.get("/users/:userId", handleGetJobFromUser);
/**
 * Gets all jobs created by the given user and sends them as an array
 * @param {Object} request The incoming http request with body containing the user's ID
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 */
async function handleGetJobFromUser(request, response) {
    try{
        const userId = request.params.userId;
        const allJobsFromUser = await model.getAllJobsFromUser(userId);

        response.send(allJobsFromUser);
    }
    catch (error) {
        sendError(error, response);
    }
}


router.get('/', handleGetJobs)
/**
 * Gets a list of ALL jobs in the ByteBoard database
 * @param {Object} request The incoming http request. Should have nothing
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 */
async function handleGetJobs(request, response) {
    try {
        let jobList = await model.getAllJobs();
        response.send(jobList);
    }

    catch (error) {
        sendError(error, response);
    }
}


router.put("/", handleUpdateJob);
/**
 * Updates a job's information if the user exists and sends the updated user object
 * @param {Object} request The incoming http request with the body containing the ID of the post to update as well as the properties to update
 * @param {Object} response The outgoing http response (200 on success, 400 on user failure, 500 on system failure)
 */
async function handleUpdateJob(request, response) {
    try {
        const jobId = request.body.jobId;
        const job = await model.getSingleJob(jobId);
        const currentUser = await sessionController.getAuthenticatedUser(request);
        const jobAuthor = await getSingleUser(null, job.authorId);

        // The person updating the post must be the author
        if (areUsersIdentical(currentUser, jobAuthor)) {
            const updatedPost = await model.updatePost(jobId, request.body, true);

            response.send(updatedPost);
        }
        else
            response.sendStatus(401);
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
