const express = require('express')
const router = express.Router()
const routeRoot = '/'
const {authenticateUser,refreshSession} = require('./sessionController')

module.exports = {

    router,
    routeRoot
}



// home URL
router.get(routeRoot, (request, response) => {

    const authenticatedSession = authenticateUser(request);
    if (!authenticatedSession) {
        response.sendStatus(401); // Unauthorized access
        return;
    }
    console.log("User " + authenticatedSession.userSession.username + " is authorized for home page");


    response.cookie('name', authenticatedSession.userSession.username )
    response.cookie('username', authenticatedSession.userSession.username )

    refreshSession(request, response);

    response.send('Hello user ' + authenticatedSession.userSession.username)
})