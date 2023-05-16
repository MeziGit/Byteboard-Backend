const validator = require("validator");
const {InvalidInputError} = require("../models/InvalidInputError.js");

const MIN_PWD_LENGTH = 10;


/**
 * Returns true if the given username is valid and false otherwise.
 * @param {String} username The username to validate
 * @returns True if the given username is valid and false otherwise
 */
function isUsernameValid(username) {
    // Temporary code
    return true;
}

/**
 * Returns true if the email is of the valid email format and throws an error otherwise
 * @param {String} email The email to validate
 * @returns True if the email is of the valid email format and throws an error otherwise
 * @throws InvalidInputError if the email is not of the valid email format
 */
function isEmailValid(email) {
    if (!validator.isEmail(email))
        throw new InvalidInputError("Email is of an invalid format (Proper format: \"user@example.com\")");

    return true;
}

/**
 * Returns true if the given password is valid and false otherwise.
 * @param {String} password The password to validate
 * @returns True if the given password is valid and false otherwise.
 */
function isPasswordValid(password) {
    let hasLetter = false;
    let hasNumber = false;

    if (password.length < MIN_PWD_LENGTH)
        throw new InvalidInputError(`Password must be at least ${MIN_PWD_LENGTH} characters`);
    
        
    // Check if the password has at least one letter and one number
    for (let i = 0; i < password.length; i++) {
        if (validator.isAlpha(password.substring(i, i + 1)))
            hasLetter = true;
        if (validator.isNumeric(password.substring(i, i + 1)))
            hasNumber = true;

        if (hasLetter && hasNumber)
            break;
    }

    if (!hasLetter && !hasNumber)
        throw new InvalidInputError("Password must have alphabetic and numerical characters");
    if (!hasLetter)
        throw new InvalidInputError("Password must have at least one alphabetic character");
    if (!hasNumber)
        throw new InvalidInputError("Password must have at least one numerical character");

    return true;
}

/**
 * Returns true if all the credentials are valid and throws an error otherwise.
 * See isUsernameValid, isEmailValid, and/or isPasswordValid for more details
 * @param {String} username The username to validate
 * @param {String} email The email to validate. Must be of the proper email format
 * @param {String} password The password to validate
 * @returns True if all the credentials are valid and throws an error otherwise
 * @throws InvalidInputError if any of the credentials are invalid
 */
function areAllCredentialsValid(username, email, password) {
    return isUsernameValid(username) && isEmailValid(email) && isPasswordValid(password);
}

module.exports = { isUsernameValid, isEmailValid, isPasswordValid, areAllCredentialsValid };