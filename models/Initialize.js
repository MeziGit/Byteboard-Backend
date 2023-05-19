require('dotenv').config();
const { MongoClient, MongoError } = require("mongodb");
const { DatabaseError } = require("./DatabaseError");
const { InvalidInputError } = require("./InvalidInputError");
const logger = require('../logger');
const collation = {locale: "en", strength: 1};

let client;
let clientDbName;
let collection;
let isResettingFlag;

/**
 * Initializes and returns a connection to the database
 * @param {String} databaseName The name of the database to connect to
 * @param {string} urlInput The URL to connect to the database
 * @returns An object that represents connection to the database
 * @throws {DatabaseError} if something wrong happened in the database or the system
 * @throws {InvalidInputError} if the urlInput is undefined or null
 */
async function initializeConnection(databaseName, urlInput, resetFlag = false) {
    if (urlInput === undefined || urlInput === null)
        throw new InvalidInputError(`url must be specified`);

    try{
        logger.info("Initializing connection");
        const url = urlInput;
        client = new MongoClient(url);
        clientDbName = databaseName;

        isResettingFlag = resetFlag;

        await client.connect();
        logger.info(`Connected to the "${databaseName}" database`);

        return client;
    }
    catch(err){
        throw new DatabaseError(err.message);
    }
}


/**
 * Closes the database connection
 */
async function close() {
    try {
        await client.close();
        logger.debug(`Database connection closed successfully`);
    }
    catch(err) {
        logger.error(`${err.name}: ${err.message}`);
    }
}



/**const db = client.db(databaseName);
 * Returns a collection from the database
 * @param {String} collectionName The name of the collection
 * @param {Boolean} resetFlag Represents whether to drop the collection and recreate it. Default is false
 * @returns A collection from the database
 */
async function getCollection(collectionName) {
    /// Get the collection
    const db = client.db(clientDbName);
    const collectionCursor = await db.listCollections({name: collectionName});          
    const collectionArray = await collectionCursor.toArray();

    logger.debug("collection array initialized");

    /// Drop the collection if instructed to
    if (isResettingFlag) {
        console.log("resetting");
        const tmpCollection = await db.collection(collectionName);
        tmpCollection.drop();
        console.log("dropped collection");
        logger.debug("Dropped the temporary collection");
    }

    if (collectionArray.length == 0) {
        await db.createCollection(collectionName, {collation: collation});
       logger.debug(`Created the "${collectionName}" collection`);
    }
    
    return db.collection(collectionName);
}


/**
 * Turns a MongoError into a DatabaseError, and any other error (aside from InvalidInputError)
 * @param {Error} error The error to be thrown
 * @param {String} actionThatThrewError The action that was being performed when the error occurred (in the present tense). Example: "create a user"
 * @throws A DatabaseError if the error was a MongoError, InvalidInputError if it's an InvalidInputError, and an Unexpected Error if it's anything else
 */
function throwProperError(error, actionThatThrewError) {
    logger.error(`${error.message}`);

    if (error instanceof InvalidInputError || error instanceof DatabaseError)
        throw error;
    else if (error instanceof MongoError)
        throw new DatabaseError(error.message);
    
    throw new Error(`Unexpected error occurred while trying to ${actionThatThrewError}: (${error.name}) ${error.message}`);
}



module.exports = { initializeConnection, close, getCollection, throwProperError };