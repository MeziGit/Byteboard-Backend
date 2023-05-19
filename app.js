const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require('cookie-parser')
const logger = require('./logger')
const express = require('express')
const app = express();
const corsOptions = {
    origin: "http://localhost:3000",
    credentials: true,
};

app.use(cors(corsOptions));
/**
 * CORS middleware method allows access control for all routes
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With, Accept, Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000","http://localhost:1339");
    res.setHeader("Access-Control-Allow-Credentials", true);
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, DELETE, OPTIONS, PATCH");
    next();
});
app.use(cookieParser());

const controllers = ['sessionController', 'userController', 'postController', 'postCommentController','jobController', 'homeController', 'errorController']

app.use(express.json());
// Configuring body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());



//Register routes from all controllers
// Assumes a flat directory structure and common 'routeRoot' / 'router' exports
controllers.forEach((controllerName) => {
    try {
        const controllerRoutes = require('./controllers/' + controllerName)

        app.use(controllerRoutes.routeRoot,
            controllerRoutes.router)
    } catch (error) {
        // fail gracefully if no routes for this controller
        logger.error(error)
        throw error
    }
})

const listEndpoints = require('express-list-endpoints')

console.log(listEndpoints(app))

module.exports = app