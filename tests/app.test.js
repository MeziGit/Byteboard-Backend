require('dotenv').config()
const initializer = require("/models/Initialize");
const db = process.env.DB_NAME;
require('mongodb')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { InvalidInputError } = require('../models/InvalidInputError')
const { DatabaseError } = require('../models/DatabaseError')

//#region Models
const sessionModel = require('../models/Session');
const userModel = require("../models/UserModel");
const postModel = require("../models/PostModel");
const postCommentModel = require("../models/PostCommentModel");
const jobModel = require("../models/JobModel");
//#endregion

//#region Controllers
const sessionController = require('../controllers/sessionController');
const userController = require('../controllers/userController');
const postController = require('../controllers/postController');
const postCommentController = require('../controllers/postCommentController');
const jobModelController = require('../controllers/jobController');
//#endregion

//#region Sample Data
const sampleUsers = [
    {username: "test1", "email": "test1@example.com", "password": "test12345678"},
    {username: "test2", "email": "test2@example.com", "password": "test12345678"},
    {username: "test3", "email": "test3@example.com", "password": "test12345678"},
    {username: "test4", "email": "test4@example.com", "password": "test12345678"},
    {username: "test5", "email": "test5@example.com", "password": "test12345678"},
    {username: "test6", "email": "test6@example.com", "password": "test12345678"},
    {username: "test7", "email": "test7@example.com", "password": "test12345678"},
    {username: "test8", "email": "test8@example.com", "password": "test12345678"},
    {username: "test9", "email": "test9@example.com", "password": "test12345678"},
    {username: "test10", "email": "test10@example.com", "password": "test12345678"},
];

//#region Sample Methods
/**
 * Gets random user data from the sampleUsers array
 * @returns {Object} random user data
 */
const getRandomUserData = function() {
    const randomUser = Math.floor(Math.random() * sampleUsers.length);
    return randomUser;
}
/**
 * Gets post data
 * @returns {Object} post data
 */
const getPostData = async function() {
    const randomUser = await getRandomExistingUser();
    const allTopics = await getPostTopicNames();
    const post = {postTitle: "testpost", postContent: "content woagoihujgg", authorId: randomUser._id, topicNames: allTopics};
}
/**
 * Gets a list of all post topics
 * @returns A list of all post topics
 */
const getPostTopicNames = async function() {
    const topics = await postModel.getAllPostTopics();
    const topicNames = topics.map(topic => {
        return topic.topicName;
    });
    return topics;
}
/**
 * Gets a random existing user
 * @returns A random user
 */
const getRandomExistingUser = async function() {
    const allUsers = await userModel.getAllUsers();
    const randomUser = Math.floor(Math.random() * allUsers.length);

    return randomUser;
}
//#endregion
//#endregion


const urlOriginal = process.env.URL_PRE + process.env.MONGODB_PWD + process.env.URL_POST
let mongod
jest.setTimeout(5000)

const app = require('../app')
const supertest = require('supertest')
const logger = require('../logger')
const testRequest = supertest(app)


// creates a mongomemory server before the tests run
beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    logger.info("Mock Database started");
})

// closes mock database after all the tests are finished
afterAll(async () => {
    await mongod.stop();
    logger.info("Mock Database Stopped");
})


/**
 * Initializes the mongodb cluster and resets the collection before each test
 * goes on mongodb cluster locally
 */
beforeEach(async () => {
    try {
        const url = await mongod.getUri();
        await initializer.initialize(url, true, "users");
    }
    catch (error) {
        logger.error(error.message);
    }
})

/**
 * closes the client connection after each test
 */
afterEach(async () => {
    await initializer.close();
})



test("Register user success case", async function() {
    const user = getRandomUserData();
    const createdUser = await userModel.createUser(user.username, user.email, user.password);

    expect(createdUser).toBeDefined();
});