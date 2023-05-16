const express = require('express')
const router = express.Router()
const routeRoot = '*'  // gets route from all endpoints

module.exports = {

    router,
    routeRoot
}

// checks if URL is valid, throws 404 error otherwise
router.all(routeRoot,(request,response)=> {
    response.status(404)

    response.send('Invalid URL entered. Please try again')
})