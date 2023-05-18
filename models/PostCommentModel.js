const initializer = require("./Initialize");
const userModel = require("./UserModel");
const postModel = require("./PostModel");
const logger = require("../logger");
const { InvalidInputError } = require("./InvalidInputError");
const { DatabaseError } = require("./DatabaseError");
const { ObjectId } = require("mongodb");

const FORBIDDEN_UPDATE_PROPS = ["_id", "postId", "authorId", "dateCreated", "dateEdited"];
const FORBIDDEN_USER_UPDATE_PROPS = ["score", "userVotes"];

/**
 * Represents a post comment created by a user.
 */
class PostComment {
    /**
     * Initializes a new Post Comment instance
     * @param {String} content The content of the comment. Can be short or long
     * @param {String} postId The ID of the post that's being commented on
     * @param {String} authorId The ID of the user who created the comment
     */
    constructor(content, postId, authorId) {
        this.content = content;
        this.postId = postId;
        this.authorId = authorId;
        
        this.score = 0;
        this.dateCreated = Date.now();
        this.userVotes = {}; // "Dictionary" of user IDs with the values being each user's vote
        this.dateEdited = null;
    }
}

let postCommentCollection;
let postCollection;
let userCollection;

initializer.getCollection(process.env.POST_COMMENT_COLLECTION)
    .then(function(result) {
        postCommentCollection = result;
    });
initializer.getCollection(process.env.POST_COLLECTION)
    .then(function(result) {
        postCollection = result;
    });
initializer.getCollection(process.env.USER_COLLECTION)
    .then(function(result) {
        userCollection = result;
    });



/**
 * Creates a new post comment
 * @param {String} content The content of the comment
 * @param {String} postId The ID of the post (must be an existing post in the database)
 * @param {String} authorId The ID of the author (must be an existing user in the database)
 * @returns {PostComment} The created post comment
 * @throws InvalidInputError if the requested properties are not valid
 * @throws DatabaseError if something went wrong in MongoDB
 */
async function createPostComment(content, postId, authorId) {
    try {
        const author = await userModel.getSingleUser(null, authorId);
        const post = await postModel.getSinglePost(postId);


        if (author && post) {
            const newPostComment = new PostComment(content, post._id, authorId);
            const result = postCommentCollection.insertOne(newPostComment);

            if (!result)
                throw new InvalidInputError("Could not create new post comment");

            post.comments.push(newPostComment._id);
            await postModel.updatePost(postId, {comments: post.comments});

            return newPostComment;
        }
    }
    catch(err) {
        initializer.throwProperError(err, "create a post comment");
    }
}


/**
 * Searches for and returns a specific post comment using the specified comment ID
 * @param {String} postCommentId The ID of the post comment to search for
 * @returns {PostComment} The found post comment object
 * @throws InvalidInputError if the requested post comment doesn't exist
 * @throws DatabaseError if something went wrong in MongoDB
 */
async function getSinglePostComment(postCommentId) {
    try {
        const comment = await postCommentCollection.findOne({_id : new ObjectId(postCommentId)});

        if (!comment) 
            throw new InvalidInputError(`The requested comment doesn't exist`);

        return comment;
    }
    catch(error) {
        initializer.throwProperError(error, "get a single post comment");
    }
}


/**
 * Returns a list of all the comments on a specific post
 * @returns {PostComment[]} A list of all the comments on a specific post
 */
async function getAllPostComments(postId) {
    try {
        const post = await postModel.getSinglePost(postId);
        const commentList = await Promise.all(post.comments.map(async commentId => {
            try {
                const comment = await getSinglePostComment(commentId);
                return comment;
            }
            catch(error) {
                logger.error(error.message);
            }
            
            return null;
        }));

        return commentList;
    }
    catch(error) {
        initializer.throwProperError(error, "get all comments for a post");
    }
}

/**
 * Gets all posts created by the given user and returns them as an array
 * @param {User} userId The ID of the user to get the posts from
 * @returns {Array} An array of posts created by the given user
 */
async function getAllPostsCommentsFromUser(userId) {
    try {
        const user = await userModel.getSingleUser(null, userId);
        const commentsCursor = await postCommentCollection.find({authorId: new ObjectId(user._id)});

        if (!commentsCursor) {
            logger.info(`${user.username} has no comments`);
            return [];
        }

        const allPostCommentsFromUser = await commentsCursor.toArray();
        return allPostCommentsFromUser;
    }
    catch(error) {
        initializer.throwProperError(error, "get all posts from a user");
    }
}


/**
 * Updates a ByteBoard post comment and returns it if successful
 * @param {String} postCommentId The ID of the post comment
 * @param {Object} propertiesToUpdate The properties of the post comment to update. There are a few that are forbidden to update
 * @param {Boolean} isUserEditing Determines whether a user is editing the post comment or the system is editing it. Is false by default
 * @returns {PostComment} The updated post comment
 * @throws {DatabaseError} If there was no result from the attempt to update the post comment
 * @throws {InvalidInputError} If there was a result but nothing was updated
 */
async function updatePostComment(postCommentId, propertiesToUpdate, isUserEditing = false) {
    try {
        const comment = await getSinglePostComment(postCommentId);
        const commentProps = Object.getOwnPropertyNames(comment);
        const updatedProperties = isUserEditing ? {dateEdited: Date.now()} : {};
        
        for (let i = 0; i < commentProps.length; i++) {
            let prop = commentProps[i];
            propValue = propertiesToUpdate[prop];

        
            // The property must not be a forbidden-to-update one
            if (FORBIDDEN_UPDATE_PROPS.indexOf(prop) === -1 && (!isUserEditing || FORBIDDEN_USER_UPDATE_PROPS.indexOf(prop) === -1)) {
                if (propValue !== undefined && propValue !== null) {
                    updatedProperties[prop] = propValue;
                }
            }
        }


        const result = await postCommentCollection.updateOne({_id: comment._id}, {$set: updatedProperties});

        if (!result)
            throw new DatabaseError("Could not update the post comment");
        if (result.modifiedCount === 0)
            new InvalidInputError("No post comments were updated")

        const updatedPostComment = await getSinglePostComment(postCommentId);
        return updatedPostComment;
    }
    catch(error) {
        initializer.throwProperError(error, "update a post's details");
    }
}


/**
 * Alters to a post comment's score based on a user's vote
 * @param {String} postCommentId The ID of the post comment
 * @param {User} votingUser The username of the user who voted
 * @param {Number} vote The type of vote the user put. 1 will add to the score, whereas -1 will remove from the score. 0 will just remove the user's vote
 */
async function votePost(postCommentId, votingUser, vote) {
    try {
        const comment = await getSinglePostComment(postCommentId);
        const postAuthor = await userModel.getSingleUser(null, comment.authorId);
        const userVote = comment.userVotes[votingUser._id];
        const voteExists = userVote !== undefined && userVote !== null;
        const isVoterPostAuthor = userModel.areUsersIdentical(votingUser, postAuthor);


        if (vote !== 1 && vote !== -1 && !voteExists)
            throw new InvalidInputError("Vote invalid");


        if (voteExists) {
            // Undo the user's vote
            comment.userVotes[votingUser._id] = null;
            comment.score -= userVote;

            // if (!isVoterPostAuthor)
            //     postAuthor.reputation -= userVote;
        }
        else {
            // Increase/decrease the score depending on the user's vote
            comment.userVotes[votingUser._id] = vote;
            comment.score += vote;

            // if (!isVoterPostAuthor) 
            //     postAuthor.reputation += vote;
        }

        // if (!isVoterPostAuthor)
        //     await userModel.updateUser(postAuthor.username, {reputation: postAuthor.reputation});

        await updatePostComment(comment._id, {score: comment.score, userVotes: comment.userVotes});
    }
    catch(error) {
        initializer.throwProperError(error, "vote a post");
    }
}


/**
 * Searches for and deletes a post comment from the database. If successful, the deleted comment will be returned, otherwise errors will be thrown
 * @param {String} postCommentId The ID of the post comment to delete
 * @returns {Post} The deleted comment if successful
 * @throws {DatabaseError} If there was no result from the attempt to delete the comment
 * @throws {InvalidInputError} If there was a result but nothing was deleted
 */
async function deletePostComment(postCommentId) {
    try {
        const commentToDelete = await getSinglePostComment(postCommentId);
        const post = await postModel.getSinglePost(commentToDelete.postId);
        const result = await postCommentCollection.deleteOne({_id: new ObjectId(postCommentId)});
        
        if (!result)
            throw new DatabaseError("Couldn't delete the post comment");
        if (result.deletedCount == 0)
             throw new InvalidInputError("No post comments were deleted");

        // Delete the comment from the post's comment array
        const indexOfComment = post.comments.indexOf(commentToDelete._id);
        post.comments.splice(indexOfComment, 1);
        //
        await postModel.updatePost(post._id, {comments: post.comments});


        return commentToDelete;
    }
    catch(error) {
        initializer.throwProperError(error, "delete a post comment");
    }
}

module.exports = { createPostComment, getSinglePostComment, getAllPostComments, getAllPostsCommentsFromUser, updatePostComment, votePost, deletePostComment };