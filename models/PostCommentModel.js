const initializer = require("./Initialize");
const userModel = require("./UserModel");
const postModel = require("./PostModel");
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
            const newPostComment = new PostComment(content, postId, authorId);
            const result = postCommentCollection.insertOne(newPostComment);

            if (!result)
                throw new InvalidInputError("Could not create new post comment");

            post.comments.push(newPostComment);
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
 * Updates a ByteBoard post and returns it if successful
 * @param {String} postId The ID of the post 
 * @param {Object} propertiesToUpdate 
 * @param {Boolean} isUserEditing Determines whether a user is editing the post or the system is editing it. Is false by default
 * @returns The updated post
 * @throws {DatabaseError} If there was no result from the attempt to update the post
 * @throws {InvalidInputError} If there was a result but nothing was updated
 */
async function updatePost(postId, propertiesToUpdate, isUserEditing = false) {
    try {
        const post = await getSinglePostComment(postId);
        const postProps = Object.getOwnPropertyNames(post);
        const updatedProperties =  {dateEdited: Date.now()};
        
        for (let i = 0; i < postProps.length; i++) {
            let prop = postProps[i];
            propValue = propertiesToUpdate[prop];

        
            // The property must not be a forbidden-to-update one
            if (FORBIDDEN_UPDATE_PROPS.indexOf(prop) === -1) {
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

        const updatedPost = await getSinglePostComment(postId);
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
        const post = await getSinglePostComment(postId);
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
        const postToDelete = await getSinglePostComment(postId);
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

module.exports = { createPostComment, getSinglePostComment, getAllPosts, updatePost, votePost, deletePost };