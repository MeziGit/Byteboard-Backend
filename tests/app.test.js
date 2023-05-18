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



test("Register user success case", function() {

});