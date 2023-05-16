require('dotenv').config()
let model = require('../models/netflixModelMongoDb')
let db = "netflix_db_test"
require('mongodb')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { InvalidInputError } = require('../models/InvalidInputError')
const { DatabaseError } = require('../models/DatabaseError')


const urlOriginal = process.env.URL_PRE + process.env.MONGODB_PWD + process.env.URL_POST
let mongod
jest.setTimeout(5000)

const app = require('../app')
const supertest = require('supertest')
const logger = require('../logger')
const testRequest = supertest(app)


// creats a mongomemory server before the tests run
beforeAll(async () => {

    mongod = await MongoMemoryServer.create()


    logger.info("Mock Database started")

})

// closes mock database after all the tests are finished
afterAll(async () => {

    await mongod.stop()


    logger.info("Mock Database Stopped")
})


/**
 * Initializes the mongodb cluster and resets the collection before each test
 * goes on mongodb cluster locally
 */
beforeEach(async () => {

    try {

        const url = await mongod.getUri()

        await model.initialize(url,true,"users")

    }
    catch (error) {
        logger.error(error.message)
    }
})

/**
 * closes the client connection after each test
 */
afterEach(async () => {

    await model.close()

})
