const { MongoClient, MongoError, ObjectId } = require("mongodb");
const initializer = require("./Initialize");
const validator = require("../utils/ByteBoardValidator");
const { InvalidInputError } = require("./InvalidInputError");
const { DatabaseError } = require("./DatabaseError");
const logger = require("../logger");
const bcrypt = require('bcrypt');

const DEFAULT_ACCOUNT_DESCRIPTION = "Hi, I'm a new ByteBoard user";
const DEFAULT_PFP = "https://cdn.discordapp.com/attachments/667872583538180137/1105656082136842330/Default_Pfp.png";
const PUBLIC_USER_PROPS = ["_id", "username", "email", "displayName", "description", "reputation", "profilePicture", "verified", "admin"];
const FORBIDDEN_UPDATE_PROPS = ["_id", "verified", "admin", "reputation"];
const saltRounds = 10;

/**
 * Represents a user of the app
 */
class User {
    /**
     * Initializes a new user object
     * @param {String} username The username of the user
     * @param {String} email The email of the user
     * @param {String} password The password of the user
     */
    constructor(username, email, password) {
        this.username = username;
        this.email = email;
        this.password = password;
        
        this.displayName = username;
        this.description = DEFAULT_ACCOUNT_DESCRIPTION;
        this.reputation = 0;
        this.profilePicture = DEFAULT_PFP;
        this.verified = false;
        this.admin = false;
    }
}



let userCollection;

initializer.getCollection(process.env.USER_COLLECTION)
    .then(function(result) {
        userCollection = result;
    });
    

/**
 * Returns an object with all a user's information that only the public is allowed to see
 * @param {User} user The user object to retrieve information from
 * @returns {Object} An object with all a user's information that only the public is allowed to see
 */
function getPublicUserInfo(user) {
    const publicUser = {};

    for (let i = 0; i < PUBLIC_USER_PROPS.length; i++) {
        const currentPropName = PUBLIC_USER_PROPS[i];
        const userProp = user[currentPropName];

        if (userProp != null && userProp != undefined)
            publicUser[currentPropName] = userProp;
    }

    return publicUser;
}

/**
 * Returns an object containing all of a user's information
 * @param {User} user The user object to retrieve information from
 * @returns {Object} An object containing all of a user's information
 */
function getAllUserInfo(user) {
    const userPropNames = Object.getOwnPropertyNames(user);
    const returnUser = {};

    for (let i = 0; i < userPropNames.length; i++) {
        const currentPropName = userPropNames[i];
        const userProp = user[currentPropName];
        

        if (userProp != null && userProp != undefined)
            returnUser[currentPropName] = userProp;
    }

    return returnUser;
}


/**
 * Adds a new user to the database and returns the user object
 * @param {String} username The username of the user
 * @param {String} email The email of the user. Must be of the valid email format
 * @param {String} password The password of the user. Will become encrypted
 * @returns {User} The created user object
 * @throws InvalidInputError if the user credentials are invalid
 */
async function createUser(username, email, password, collection = userCollection) {
    try {
        if (validator.areAllCredentialsValid(username, email, password) && !(await doesUserExist(username, email))) {
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            const newUser = new User(username, email, hashedPassword);
            const result = await collection.insertOne(newUser);

            if (!result)
                throw new Error("Could not create new user, unexpected error");

            return newUser;
        }
        else throw new InvalidInputError("Invalid input")
    }
    catch(error) {
        initializer.throwProperError(error, "create a user");
        throw error;
    }
}

/**
 * Searches for an existing user and returns it if it exists, throws an error otherwise
 * @param {String} usernameToFind The name of the user to find. Will be ignored if idToFind is provided
 * @param {String} idToFind (Optional) The ID of the user to find.
 * @returns {User} The found user object. If none is found, throws an error
 * @throws InvalidInputError if the user does not exist
 */
async function getSingleUser(usernameToFind, idToFind = null) {
    try {
        const user = await userCollection.findOne(!idToFind ? {username: usernameToFind} : {_id: new ObjectId(idToFind)});

        if (!user) 
            throw new InvalidInputError(`The requested user doesn't exist (${idToFind ? "ID: " + idToFind : usernameToFind})`);

        return user;
    }
    catch(error) {
        initializer.throwProperError(error, "get a single user");
    }
}

/**
 * Returns an array of all ByteBoard users
 * @returns {User[]} An array of all the ByteBoard users
 */
async function getAllUsers()
{
    try
    {
        const cursor = await userCollection.find();
        const userList = await cursor.toArray();

        if (!userList || userList.length == 0)
            throw new DatabaseError("There are no existing ByteBoard users");

        return userList
    }
    catch (error) {
        initializer.throwProperError(error, "get a list of all users");
    }
}


/**
 * Searches for and updates a user's information
 * @param {String} usernameToUpdate The name of the user to update
 * @param {Object} propertiesToUpdate The properties to update (like username, email, etc.)
 * @param {Boolean} isUserEditing Determines whether a user is updating themself or the system is updating them. Is false by default
 * @returns {User} The updated user
 * @throws InvalidInputError if the user does not exist or did not get their properties updated
 */
async function updateUser(usernameToUpdate, propertiesToUpdate, isUserEditing = false) {
    try {
        const user = await getSingleUser(usernameToUpdate);
        const userProps = Object.getOwnPropertyNames(user);
        const updatedProperties = {};
        
        for (let i = 0; i < userProps.length; i++) {
            let prop = userProps[i];
            let propValue = propertiesToUpdate[prop];


            if (FORBIDDEN_UPDATE_PROPS.indexOf(prop) !== -1 || !isUserEditing) {
                if (propValue !== undefined && propValue !== null) {
                    switch(prop) {
                        case "username":
                            if (!(await doesUserExist(propValue)) && validator.isUsernameValid(propValue)) {}
                            break;
                        case "password":
                            if (validator.isPasswordValid(propValue)) {
                                propValue = await bcrypt.hash(propValue, saltRounds);
                            }     
                            break;
                        case "email":
                            if (!(await doesEmailExist(propValue)) && validator.isEmailValid(propValue)) {}
                            break;
                    }
                    
    
                    updatedProperties[prop] = propValue;
                }
            }
        }


        const result = await userCollection.updateOne({username: usernameToUpdate}, {$set: updatedProperties});

        if (result.modifiedCount === 0)
            throw new InvalidInputError(`Could not update ${usernameToUpdate}'s information`);

        return await getSingleUser(null, user._id);
    }
    catch(error) {
        initializer.throwProperError(error, "update a user's information");
    }
}

/**
 * Searches for and deletes a user from the database, as well as all of their posts and comments
 * @param {String} usernameToDelete 
 * @returns {User} The deleted user
 * @throws InvalidInputError if the user does not exist or did not get deleted
 */
async function deleteUser(usernameToDelete) {
    try {
        const postModel = require("./PostModel");
        const commentModel = require("./PostCommentModel");

        const user = await getSingleUser(usernameToDelete);
        const userPosts = await postModel.getAllPostsFromUser(user._id);
        const userPostComments = await commentModel.getAllPostsCommentsFromUser(user._id);

        const result = await userCollection.deleteOne({username: usernameToDelete});
        
        if (result.deletedCount == 0)
             throw new InvalidInputError(`Could not delete ${usernameToDelete}`);

        // Delete all of the user's posts and comments
        for (let i = 0; i < userPostComments.length; i++)
            await commentModel.deletePostComment(userPostComments[i]._id);
        
        for (let i = 0; i < userPosts.length; i++)
            await postModel.deletePost(userPosts[i]._id);

        return user;
    }
    catch(error) {
        initializer.throwProperError(error, "delete a user");
    }
}


/**
 * Checks if two users have the same ID and returns the result
 * @param {User} user1 The first user to compare
 * @param {User} user2 The second user to compare
 * @returns {Boolean} Whether the two users have the same ID or not
 */
function areUsersIdentical(user1, user2) {
    return user1._id.toString() === user2._id.toString();
}


async function doesUserExist(username, email) {
    const usernameExists = await doesUsernameExist(username);
    const emailExists = await doesEmailExist(email);

    return usernameExists && emailExists;
}

async function doesUsernameExist(username) {
    const existingUserUsername = await userCollection.findOne({username: username});

    if (existingUserUsername)
        throw new InvalidInputError("A user with the given username already exists");

    return false;
}

async function doesEmailExist(email) {
    const existingUserEmail = await userCollection.findOne({email: email});

    if (existingUserEmail)
        throw new InvalidInputError("A user with the given email already exists");

    return false;
}



module.exports = { getPublicUserInfo, getAllUserInfo, createUser, getSingleUser, getAllUsers, updateUser, deleteUser, areUsersIdentical };