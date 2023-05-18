require("dotenv").config();
const port = 1339;
const initializer = require("./models/Initialize.js");
const url = process.env.URL_PRE + process.env.MONGODB_PWD + process.env.URL_POST;
const DBNAME = process.env.DB_NAME;

initializer.initializeConnection(DBNAME, url)
.then(
    require('./app.js').listen(port) // Run the server
);
