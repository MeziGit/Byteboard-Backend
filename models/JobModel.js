const initializer = require("./Initialize");
const userModel = require("./UserModel");
const validator = require("../utils/ByteBoardValidator");
const logger = require("../logger");
const { InvalidInputError } = require("./InvalidInputError");
const { DatabaseError } = require("./DatabaseError");
const { ObjectId } = require("mongodb");

const FORBIDDEN_UPDATE_PROPS = ["_id", "authorId", "dateCreated", "dateEdited"];

/**
 * Represents a job created by a user to be fulfilled by another user.
 */
class Job {
    /**
     * Initializes a new Post instance
     * @param {String} jobTitle A short title of the job
     * @param {String} jobDescription The description of the job. Can be short or long
     * @param {Number} jobPay The reward for the job done successfully
     * @param {String} authorId The ID of the user who set up the job
     */
    constructor(jobTitle, jobDescription, jobPay, authorId) {
        this.jobTitle = jobTitle;
        this.jobDescription = jobDescription;
        this.jobPay = jobPay;
        this.authorId = authorId;
        
        this.closed = false;
        this.dateCreated = Date.now();
        this.dateEdited = null;
    }
}

let jobCollection;

initializer.getCollection(process.env.JOB_COLLECTION)
    .then(function(result) {
        jobCollection = result;
    });


/**
 * Creates a new job
 * @param {String} jobTitle A short title of the job
 * @param {String} jobDescription The description of the job. Can be short or long
 * @param {Number} jobPay The reward for the job done successfully
 * @param {String} authorId The ID of the author (must be an existing user in the database)
 * @returns {Job} The created job
 * @throws InvalidInputError if the requested properties are not valid
 * @throws DatabaseError if something went wrong in MongoDB
 */
async function createJob(jobTitle, jobDescription, jobPay, authorId) {
    try {
        const author = await userModel.getSingleUser(null, authorId);

        if (author) {
            const newJob = new Job(jobTitle, jobDescription, jobPay, authorId)
            const result = jobCollection.insertOne(newJob);

            if (!result)
                throw new InvalidInputError("Could not create new job");

            return newJob;
        }
    }
    catch(err) {
        initializer.throwProperError(err, "create a job");
    }
}


/**
 * Searches for and returns a specific job using the specified job ID
 * @param {String} jobId The ID of the post to search for
 * @returns {Job} The found job object
 * @throws InvalidInputError if the requested post doesn't exist
 * @throws DatabaseError if something went wrong in MongoDB
 */
async function getSingleJob(jobId) {
    try {
        const post = await jobCollection.findOne({_id : new ObjectId(jobId)});

        if (!post) 
            throw new InvalidInputError(`The requested job doesn't exist`);

        return post;
    }
    catch(error) {
        initializer.throwProperError(error, "get a single job");
    }
}


/**
 * Returns a list of all the jobs in the database
 * @returns {Job[]} A list of all the jobs in the database
 */
async function getAllJobs() {
    try {
        const cursor = await jobCollection.find();
        const jobList = await cursor.toArray();

        if (!jobList || jobList.length == 0)
            throw new DatabaseError("Couldn't get all jobs");

        return jobList
    }
    catch(error) {
        initializer.throwProperError(error, "get all jobs");
    }
}

/**
 * Gets all jobs created by the given user and returns them as an array
 * @param {User} userId The ID of the user to get the jobs from
 * @returns {Array} An array of jobs created by the given user
 */
async function getAllJobsFromUser(userId) {
    try {
        const user = await userModel.getSingleUser(null, userId);
        const jobCursor = await jobCollection.find({authorId: new ObjectId(user._id)});

        if (!jobCursor) {
            logger.info(`${user.username} has no jobs`);
            return [];
        }

        const allJobsFromUser = await jobCursor.toArray();
        return allJobsFromUser;
    }
    catch(error) {
        initializer.throwProperError(error, "get all jobs from a user");
    }
}


/**
 * Updates a ByteBoard job and returns it if successful
 * @param {String} jobId The ID of the job 
 * @param {Object} propertiesToUpdate The properties of the job to update. There are a few that are forbidden to update
 * @param {Boolean} isUserEditing Determines whether a user is editing the job or the system is editing it. Is false by default
 * @returns {Job} The updated job
 * @throws {DatabaseError} If there was no result from the attempt to update the job
 * @throws {InvalidInputError} If there was a result but nothing was updated
 */
async function updateJob(jobId, propertiesToUpdate, isUserEditing = false) {
    try {
        const job = await getSingleJob(jobId);
        const jobProps = Object.getOwnPropertyNames(job);
        const updatedProperties = isUserEditing ? {dateEdited: Date.now()} : {};
        
        for (let i = 0; i < jobProps.length; i++) {
            let prop = jobProps[i];
            propValue = propertiesToUpdate[prop];

        
            // The property must not be a forbidden-to-update one
            if (FORBIDDEN_UPDATE_PROPS.indexOf(prop) === -1) {
                if (propValue !== undefined && propValue !== null) {
                    updatedProperties[prop] = propValue;
                }
            }
        }


        const result = await jobCollection.updateOne({_id: job._id}, {$set: updatedProperties});

        if (!result)
            throw new DatabaseError("Could not update the job");
        if (result.modifiedCount === 0)
            new InvalidInputError("No jobs were updated")

        const updatedJob = await getSingleJob(jobId);
        return updatedJob;
    }
    catch(error) {
        initializer.throwProperError(error, "update a job's details");
    }
}


/**
 * Searches for and deletes a job from the database. If successful, the deleted job will be returned, otherwise errors will be thrown
 * @param {String} jobId The ID of the job to delete
 * @returns {Job} The deleted job if successful
 * @throws {DatabaseError} If there was no result from the attempt to delete the job
 * @throws {InvalidInputError} If there was a result but nothing was deleted
 */
async function deleteJob(jobId) {
    try {
        const jobToDelete = await getSingleJob(jobId);
        const result = await jobCollection.deleteOne({_id: new ObjectId(jobId)});
        
        if (!result)
            throw new DatabaseError("Couldn't delete job");
        if (result.deletedCount == 0)
             throw new InvalidInputError("No jobs were deleted");

        return jobToDelete;
    }
    catch(error) {
        initializer.throwProperError(error, "delete a job");
    }
}


module.exports = { createJob, getSingleJob, getAllJobs, getAllJobsFromUser, updateJob, deleteJob };