if (process.env.nodeEnv !== "AWS")
    require('dotenv').config()

const serverless = require('serverless-http');
const express = require("express")
const bodyParser = require("body-parser")
const app = express()

var cors = require('cors')
var contentful = require('contentful-management')

//Here we are configuring express to use body-parser as middle-ware.
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(cors())

//cons config vars
const port = process.env.port
const spaceId = process.env.spaceId
const accessToken = process.env.accessToken
const env = process.env.env

const validateEmail = (email) => {
    const re = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;
    return re.test(String(email).toLowerCase());
}

var client = contentful.createClient({
    // This is the access token for this space. Normally you get both ID and the token in the Contentful web app
    accessToken: accessToken
})

app.post('/comments', (req, res) => {
    //validate input
    if (req.body.id && req.body.id.trim() !== ""
        && req.body.comment
        && req.body.comment.name && req.body.comment.name.trim() !== ""
        && req.body.comment.handle && req.body.comment.handle.trim() !== "" && validateEmail(req.body.comment.handle.trim())
        && req.body.comment.text && req.body.comment.text.trim() !== ""
        && req.body.comment.date && !isNaN(Date.parse(req.body.comment.date.trim()))
        && req.body.comment.replies && Array.isArray(req.body.comment.replies)) {

        //sanitize input
        req.body.id = req.body.id.trim()
        req.body.comment.name = req.body.comment.name.trim()
        req.body.comment.handle = req.body.comment.handle.trim()
        req.body.comment.text = req.body.comment.text.trim()

        client.getSpace(spaceId)
            .then(space => space.getEnvironment(env))
            .then(environment => environment.getEntry(req.body.id))
            .then(entry => {

                if (entry.fields.comments)
                    entry.fields.comments['en-US'].push(req.body.comment)
                else
                    entry.fields.comments = { "en-US": [req.body.comment] }

                return entry.update()
            })
            .then(entry => {
                console.log(`Entry ${entry.sys.id} updated.`)
                res.sendStatus(200)
            })
            .catch(error => {
                console.log(error)
                res.sendStatus(500)
            })
    }
    else
        res.sendStatus(400)
})

app.post('/rating', (req, res) => {
    //validate input
    if (req.body.id && req.body.id.trim() !== ""
        && req.body.rating
        && req.body.rating.name && req.body.rating.name.trim() !== ""
        && req.body.rating.handle && req.body.rating.handle.trim() !== "" && validateEmail(req.body.rating.handle.trim())
        && req.body.rating.date && !isNaN(Date.parse(req.body.rating.date.trim()))
        && req.body.rating.ratingValue && Number.isInteger(req.body.rating.ratingValue)) {

        //sanitize input
        req.body.id = req.body.id.trim()
        req.body.rating.name = req.body.rating.name.trim()
        req.body.rating.handle = req.body.rating.handle.trim()

        client.getSpace(spaceId)
            .then(space => space.getEnvironment(env))
            .then(environment => environment.getEntry(req.body.id))
            .then(entry => {
                //if ratings exist
                if (entry.fields.ratings && entry.fields.ratingCount && entry.fields.ratingValue) {
                    let currentCount = entry.fields.ratingCount["en-US"]
                    let currentVal = entry.fields.ratingValue["en-US"]

                    //check if user already sbumitted a rating
                    if (entry.fields.ratings["en-US"][req.body.rating.handle]) {
                        //calculate new values by subtracting the olf rating
                        let currentUserRating = entry.fields.ratings["en-US"][req.body.rating.handle][0].ratingValue
                        let newRating = (((currentVal * currentCount) - currentUserRating) + req.body.rating.ratingValue) / currentCount

                        //update rating value overwrite rating. No need to update count
                        entry.fields.ratingValue = { "en-US": Math.round(newRating * 10) / 10 }
                    }
                    else {
                        let newRating = ((currentVal * currentCount) + req.body.rating.ratingValue) / (currentCount + 1)

                        //update rating value and count
                        entry.fields.ratingCount = { "en-US": currentCount + 1 }
                        entry.fields.ratingValue = { "en-US": Math.round(newRating * 10) / 10 }
                    }

                    //add rating to list or overwrite if handle already exists
                    entry.fields.ratings['en-US'][req.body.rating.handle] = [req.body.rating]
                }
                else {
                    //set first value and set count to 1
                    entry.fields.ratingValue = { "en-US": req.body.rating.ratingValue }
                    entry.fields.ratingCount = { "en-US": 1 }
                    //create new list and add first rating
                    entry.fields.ratings = { "en-US": { [req.body.rating.handle]: [req.body.rating] } }
                }

                return entry.update()
            })
            .then(entry => {
                console.log(`Entry ${entry.sys.id} updated.`)
                res.send({ "newRatingValue": entry.fields.ratingValue["en-US"], "newRatingCount": entry.fields.ratingCount["en-US"] })
            })
            .catch(error => {
                console.log(error)
                res.sendStatus(500)
            })
    }
    else
        res.sendStatus(400)
})

app.post('/replies', (req, res) => {
    //validate input
    if (req.body.id && req.body.id.trim() != ""
        && req.body.reply
        && req.body.reply.name && req.body.reply.name.trim() !== ""
        && req.body.reply.handle && req.body.reply.handle.trim() !== "" && validateEmail(req.body.reply.handle.trim())
        && req.body.reply.text && req.body.reply.text.trim() !== ""
        && req.body.reply.date && !isNaN(Date.parse(req.body.reply.date.trim()))) {

        //sanitize input
        req.body.id = req.body.id.trim()
        req.body.reply.name = req.body.reply.name.trim()
        req.body.reply.handle = req.body.reply.handle.trim()
        req.body.reply.text = req.body.reply.text.trim()

        client.getSpace(spaceId)
            .then(space => space.getEnvironment(env))
            .then(environment => environment.getEntry(req.body.id))
            .then(entry => {
                entry.fields.comments['en-US'][req.body.comment].replies.push(req.body.reply)
                return entry.update()
            })
            .then(entry => {
                console.log(`Entry ${entry.sys.id} updated.`)
                res.sendStatus(200)
            })
            .catch(error => {
                console.log(error)
                res.sendStatus(500)
            })
    }
    else
        res.sendStatus(400)
})


app.get('/comments', (req, res) => {
    //validate input
    if (req.query.id && req.query.id.trim() != "") {

        //sanitize input
        req.query.id = req.query.id.trim()

        client.getSpace(spaceId)
            .then(space => space.getEnvironment(env))
            .then(environment => environment.getEntry(req.query.id))
            .then(entry => {
                if (entry.fields.enableComments["en-US"] && entry.fields.comments)
                    res.send(entry.fields.comments["en-US"])
                else
                    res.send([])
            })
            .catch(error => {
                console.log(error)
                res.sendStatus(500)
            })
    }
    else
        res.sendStatus(400)
})

app.get('/rating', (req, res) => {
    //validate input
    if (req.query.id && req.query.id.trim() != "") {

        //sanitize input
        req.query.id = req.query.id.trim()

        client.getSpace(spaceId)
            .then(space => space.getEnvironment(env))
            .then(environment => environment.getEntry(req.query.id))
            .then(entry => {

                if (entry.fields.ratingValue && entry.fields.ratingCount)
                    res.send({ "ratingValue": entry.fields.ratingValue["en-US"], "ratingCount": entry.fields.ratingCount["en-US"] })
                else
                    res.send({ "ratingValue": 0, "ratingCount": 0 })
            })
            .catch(error => {
                console.log(error)
                res.sendStatus(500)
            })
    }
    else
        res.sendStatus(400)
})

if (process.env.nodeEnv !== "AWS")
    app.listen(port, () => {
        console.log(`Comment server listening at http://localhost:${port}`)
    })
else
    module.exports.handler = serverless(app);