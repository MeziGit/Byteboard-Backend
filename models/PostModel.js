const initializer = require("./Initialize");
const userModel = require("./UserModel");
const validator = require("../utils/ByteBoardValidator");
const logger = require("../logger");
const { InvalidInputError } = require("./InvalidInputError");
const { DatabaseError } = require("./DatabaseError");
const { ObjectId } = require("mongodb");

const FORBIDDEN_UPDATE_PROPS = ["_id", "authorId", "dateCreated", "dateEdited"];
const FORBIDDEN_USER_UPDATE_PROPS = ["score", "userVotes", "comments"];

/**
 * Represents a post created by a user.
 */
class Post {
    /**
     * Initializes a new Post instance
     * @param {String} postTitle A short title of the post
     * @param {String} postContent The content of the post. Can be short or long
     * @param {Number[]} topics An array of topic IDs
     * @param {String} authorId The ID of the user who created the post
     */
    constructor(postTitle, postContent, topics, authorId) {
        this.postTitle = postTitle;
        this.postContent = postContent;
        this.topics = topics;
        this.authorId = authorId;
        
        this.score = 0;
        this.dateCreated = Date.now();
        this.comments = []; // Array of comment IDs
        this.userVotes = {}; // "Dictionary" of user IDs with the values being each user's vote
        this.dateEdited = null;
    }
}

let postCollection;
let topicCollection;

initializer.getCollection(process.env.POST_COLLECTION)
    .then(function(result) {
        postCollection = result;
    });
initializer.getCollection(process.env.TOPIC_COLLECTION)
    .then(function(result) {
        topicCollection = result;
    });



/**
 * Creates a new post
 * @param {String} postTitle The title of the post
 * @param {String} postContent The content/description of the post
 * @param {String[]} topicNames An array of topic names (each must exist in the database). Must have at least one topic name
 * @param {String} authorId The ID of the author (must be an existing user in the database)
 * @returns {Post} The created post
 * @throws InvalidInputError if the requested properties are not valid
 * @throws DatabaseError if something went wrong in MongoDB
 */
async function createPost(postTitle, postContent, topicNames, authorId) {
    try {
        const author = await userModel.getSingleUser(null, authorId);
        const topics = await Promise.all(topicNames.map(async topicName => {
            const topic = await getPostTopic(topicName);
            return topic;
        }));


        if (author && topics) {
            if (topics.length <= 0)
                throw new InvalidInputError("The post must have at least one topic");

            const newPost = new Post(postTitle, postContent, topics, authorId)
            const result = postCollection.insertOne(newPost);

            if (!result)
                throw new InvalidInputError("Could not create new post");

            return newPost;
        }
    }
    catch(err) {
        initializer.throwProperError(err, "create a post");
    }
}


/**
 * Searches for and returns a specific post using the specified post ID
 * @param {String} postId The ID of the post to search for
 * @returns {Post} The found post object
 * @throws InvalidInputError if the requested post doesn't exist
 * @throws DatabaseError if something went wrong in MongoDB
 */
async function getSinglePost(postId) {
    try {
        const post = await postCollection.findOne({_id : new ObjectId(postId)});

        if (!post) 
            throw new InvalidInputError(`The requested post doesn't exist`);

        return post;
    }
    catch(error) {
        initializer.throwProperError(error, "get a single post");
    }
}


/**
 * Returns a list of all the posts in the database
 * @returns {Post[]} A list of all the posts in the database
 */
async function getAllPosts() {
    try {
        const cursor = await postCollection.find();
        const postList = await cursor.toArray();

        if (!postList || postList.length == 0)
            throw new DatabaseError("Couldn't get all posts");

        return postList
    }
    catch(error) {
        initializer.throwProperError(error, "get all posts");
    }
}



/**
 * Gets all posts created by the given user and returns them as an array
 * @param {User} userId The ID of the user to get the posts from
 * @returns {Array} An array of posts created by the given user
 */
async function getAllPostsFromUser(userId) {
    try {
        const user = await userModel.getSingleUser(null, userId);
        const postCursor = await postCollection.find({authorId: new ObjectId(user._id)});

        if (!postCursor) {
            logger.info(`${user.username} has no comments`);
            return [];
        }

        const allPostsFromUser = await postCursor.toArray();
        return allPostsFromUser;
    }
    catch(error) {
        initializer.throwProperError(error, "get all posts from a user");
    }
}

/**
 * Returns a list of all post topics available
 * @returns A list of all post topics available
 */
async function getAllPostTopics() {
    try {
        const cursor = await topicCollection.find();
        const list = await cursor.toArray();

        return list;
    }
    catch(error) {
        initializer.throwProperError(error, "get all post topics");
    }
}

/**
 * Returns all job posts
 * @returns All job
 */
async function getAllJobPosts() {
    try {
        const posts = await getAllPosts();
        const jobPosts = [];

        for (let j = 0; j < posts.length; j++) {
            const post = posts[j];
            const topics = post.topics;
            
            for (let i = 0; i < topics.length; i++) {
                const topic = topics[i];
                const id = topic.topicName;

                if (id.toString() == "Job")
                {
                    jobPosts.push(post)
                }
            }
        }
            
        return jobPosts;
    }
    catch(error) {
        initializer.throwProperError(error, "get all post topics");
    }
}


/**
 * Updates a ByteBoard post and returns it if successful
 * @param {String} postId The ID of the post 
 * @param {Object} propertiesToUpdate The properties of the post to update. There are a few that are forbidden to update
 * @param {Boolean} isUserEditing Determines whether a user is editing the post or the system is editing it. Is false by default
 * @returns {Post} The updated post
 * @throws {DatabaseError} If there was no result from the attempt to update the post
 * @throws {InvalidInputError} If there was a result but nothing was updated
 */
async function updatePost(postId, propertiesToUpdate, isUserEditing = false) {
    try {
        const post = await getSinglePost(postId);
        const postProps = Object.getOwnPropertyNames(post);
        const updatedProperties = isUserEditing ? {dateEdited: Date.now()} : {};
        
        for (let i = 0; i < postProps.length; i++) {
            let prop = postProps[i];
            propValue = propertiesToUpdate[prop];

        
            // The property must not be a forbidden-to-update one
            if (FORBIDDEN_UPDATE_PROPS.indexOf(prop) === -1 && (!isUserEditing || FORBIDDEN_USER_UPDATE_PROPS.indexOf(prop) === -1)) {
                if (propValue !== undefined && propValue !== null) {
                    updatedProperties[prop] = propValue;
                }
            }
        }


        const result = await postCollection.updateOne({_id: post._id}, {$set: updatedProperties});

        if (!result)
            throw new DatabaseError("Could not update the post");
        if (result.modifiedCount === 0)
            new InvalidInputError("No posts were updated")

        const updatedPost = await getSinglePost(postId);
        return updatedPost;
    }
    catch(error) {
        initializer.throwProperError(error, "update a post's details");
    }
}


/**
 * Alters to a post's score based on a user's vote, which then alters the poster's reputation
 * @param {String} postId The ID of the post
 * @param {User} votingUser The username of the user who voted
 * @param {Number} vote The type of vote the user put. 1 will add to the score, whereas -1 will remove from the score. 0 will just remove the user's vote
 */
async function votePost(postId, votingUser, vote) {
    try {
        const post = await getSinglePost(postId);
        const postAuthor = await userModel.getSingleUser(null, post.authorId);
        const userVote = post.userVotes[votingUser._id];
        const voteExists = userVote !== undefined && userVote !== null;
        const isVoterPostAuthor = userModel.areUsersIdentical(votingUser, postAuthor);


        if (vote !== 1 && vote !== -1 && !voteExists)
            throw new InvalidInputError("Vote invalid");


        if (voteExists) {
            // Undo the user's vote
            post.userVotes[votingUser._id] = null;
            post.score -= userVote;

            if (!isVoterPostAuthor)
                postAuthor.reputation -= userVote;
        }
        else {
            // Increase/decrease the score depending on the user's vote
            post.userVotes[votingUser._id] = vote;
            post.score += vote;

            if (!isVoterPostAuthor) 
                postAuthor.reputation += vote;
        }


        if (!isVoterPostAuthor)
            await userModel.updateUser(postAuthor.username, {reputation: postAuthor.reputation});

        await updatePost(post._id, {score: post.score, userVotes: post.userVotes});
    }
    catch(error) {
        initializer.throwProperError(error, "vote a post");
    }
}


/**
 * Searches for and deletes a post from the database. If successful, the deleted post will be returned, otherwise errors will be thrown
 * @param {String} postId The ID of the post to delete
 * @returns {Post} The deleted post if successful
 * @throws {DatabaseError} If there was no result from the attempt to delete the post
 * @throws {InvalidInputError} If there was a result but nothing was deleted
 */
async function deletePost(postId) {
    try {
        const postToDelete = await getSinglePost(postId);
        const result = await postCollection.deleteOne({_id: new ObjectId(postId)});
        
        if (!result)
            throw new DatabaseError("Couldn't delete post");
        if (result.deletedCount == 0)
             throw new InvalidInputError("No posts were deleted");

        return postToDelete;
    }
    catch(error) {
        initializer.throwProperError(error, "delete a post");
    }
}


/**
 * Searches for and returns a specific post topic using the specified topic name
 * @param {String} topicName The name of the post topic to get
 * @param {String} topicId (Optional) The id of the post topic to get. Has priority over topicName
 * @returns The found post topic
 * @throws InvalidInputError if the requested topic doesn't exist
 * @throws DatabaseError if something went wrong in MongoDB
 */
async function getPostTopic(topicName, topicId) {
    try {
        const filter = topicId === undefined || topicId === null ? {topicName: topicName} : {_id: new ObjectId(topicId)};
        const topic = await topicCollection.findOne(filter);
        

        if (!topic) 
            throw new InvalidInputError("The requested topic doesn't exist");

        return topic;
    }
    catch(err) {
        initializer.throwProperError(err, "search for a post topic");
    }
}

module.exports = { createPost, getSinglePost, getAllPosts, getAllJobPosts, getAllPostsFromUser, getAllPostTopics, getPostTopic, updatePost, votePost, deletePost };