require('dotenv').config();

const express = require("express");
const bodyParser = require("body-parser");
const app = express();

var cors = require('cors');
var contentful = require('contentful')
var contentfulManagement = require('contentful-management')

//Here we are configuring express to use body-parser as middle-ware.
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

//cons config vars
const port = process.env.port;
const spaceId = process.env.spaceId;
const accessToken = process.env.accessToken;
const env = process.env.env;

var client = contentfulManagement.createClient({
    // This is the access token for this space. Normally you get both ID and the token in the Contentful web app
    accessToken: accessToken
})

app.post('/comments', (req, res) => {
    client.getSpace(spaceId)
        .then(space => space.getEnvironment(env))
        .then(environment => environment.getEntry(req.body.id))
        .then(entry => {

            if (entry.fields.comments)
                entry.fields.comments['en-US'].push(req.body.comment);
            else
                entry.fields.comments = { "en-US": [req.body.comment] };

            return entry.update();
        })
        .then(entry => {
            console.log(`Entry ${entry.sys.id} updated.`);
            res.sendStatus(200);
        })
        .catch(error => {
            console.log(error);
            res.sendStatus(500);
        })
})

app.post('/rating', (req, res) => {
    //TODO: validate input

    client.getSpace(spaceId)
        .then(space => space.getEnvironment(env))
        .then(environment => environment.getEntry(req.body.id))
        .then(entry => {
            //if ratings exist
            if (entry.fields.ratings && entry.fields.ratingCount && entry.fields.ratingValue) {
                let currentCount = entry.fields.ratingCount["en-US"];
                let currentVal = entry.fields.ratingValue["en-US"];

                //check if user already sbumitted a rating
                if (entry.fields.ratings["en-US"][req.body.rating.handle]) {
                    //calculate new values by subtracting the olf rating
                    let currentUserRating = entry.fields.ratings["en-US"][req.body.rating.handle][0].ratingValue;
                    let newRating = (((currentVal * currentCount)  - currentUserRating) + req.body.rating.ratingValue) / currentCount;
            
                    //update rating value overwrite rating. No need to update count
                    entry.fields.ratingValue = { "en-US": Math.round(newRating * 10) / 10 };
                }
                else {
                    let newRating = ((currentVal * currentCount) + req.body.rating.ratingValue) / (currentCount + 1);

                    //update rating value and count
                    entry.fields.ratingCount = { "en-US": currentCount + 1 };
                    entry.fields.ratingValue = { "en-US": Math.round(newRating * 10) / 10 };
                }

                //add rating to list or overwrite if handle already exists
                entry.fields.ratings['en-US'][req.body.rating.handle] = [req.body.rating];
            }
            else {
                //set first value and set count to 1
                entry.fields.ratingValue = { "en-US": req.body.rating.ratingValue };
                entry.fields.ratingCount = { "en-US":  1 };
                //create new list and add first rating
                entry.fields.ratings = { "en-US": { [req.body.rating.handle]: [req.body.rating] } };
            }

            return entry.update();
        })
        .then(entry => {
            console.log(`Entry ${entry.sys.id} updated.`)
            res.send({ "newRatingValue": entry.fields.ratingValue["en-US"], "newRatingCount": entry.fields.ratingCount["en-US"] });
        })
        .catch(error => {
            console.log(error);
            res.sendStatus(500);
        })
})

app.post('/replies', (req, res) => {
    client.getSpace(spaceId)
        .then(space => space.getEnvironment(env))
        .then(environment => environment.getEntry(req.body.id))
        .then(entry => {
            entry.fields.comments['en-US'][req.body.comment].replies.push(req.body.reply);
            return entry.update();
        })
        .then(entry => {
            console.log(`Entry ${entry.sys.id} updated.`)
            res.sendStatus(200);
        })
        .catch(error => {
            console.log(error);
            res.sendStatus(500);
        })
})


app.get('/comments', (req, res) => {
    client.getSpace(spaceId)
        .then(space => space.getEnvironment(env))
        .then(environment => environment.getEntry(req.query.id))
        .then(entry => {
            if (entry.fields.enableComments["en-US"] && entry.fields.comments)
                res.send(entry.fields.comments["en-US"]);
            else
                res.send([]);
        })
        .catch(error => {
            console.log(error)
            res.send([]);
        })
})

app.get('/rating', (req, res) => {
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
            res.send({ "ratingValue": 0, "ratingCount": 0 })
        })
})

app.listen(port, () => {
    console.log(`Comment server listening at http://localhost:${port}`)
})