const express = require('express');
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId, MaxKey } = require('mongodb');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 7000;

//middleware
const corsOptions = {
    origin: ["http://localhost:5173"],
    credentials: true,
    optionSuccessStatus: 200
}
app.use(cors(corsOptions))
app.use(express.json());
app.use(cookieParser())
//----------------------------
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qvjjrvn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
// middlewares
const verifyToken = (req, res, next) => {
    console.log('i am a  middleware ');
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    console.log(token);
    if (token) {
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                console.log(err);
                return res.status(401).send({ message: 'unauthorized access' });
            }
            console.log(decoded);
            req.user = decoded;
            next();
        });
    }
};

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        const jobsCollection = client.db("soloSphere").collection("jobs");
        const bidsCollection = client.db("soloSphere").collection("bids");

        // jwt generator
        app.post('/jwt', async (req, res) => {
            const email = req?.body;
            // console.log('dynamic token for this user --->', email);
            const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' });
            // console.log(token);
            res.cookie('token', token, {
                httpOnly: true,
                secure: false,
                sameSite: 'strict'
            })
                .send({ success: true })
        });
        // Clear token on logout 
        app.get('/logout', async (req, res) => {
            const token = req.cookies;
            res.clearCookie('token', token, {
                httpOnly: true,
                secure: false,
                sameSite: 'strict',
                maxAge: 0
            })
                .send({ success: true });
        });

        // Get all jobs data from db
        app.get('/jobs', async (req, res) => {
            const result = await jobsCollection.find().toArray();
            res.send(result)
        });
        // Get a single job data from db using id
        app.get('/job/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await jobsCollection.findOne(query);
            res.send(result)
        });
        // get all jobs posted by a specific user
        app.get('/jobs/:email', verifyToken, async (req, res) => {
            const tokenEmail = req.user.email;
            const email = req.params.email;
            if (tokenEmail !== email) {
                return res.status(403).send({ message: 'Forbidden access' })
            }
            const query = { 'buyer.email': email };
            const result = await jobsCollection.find(query).toArray();
            res.send(result);
        });
        // delete a job data from db
        app.delete('/job/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await jobsCollection.deleteOne(query);
            res.send(result);
        });
        // update a job in db
        app.put('/job/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const jobData = req.body;
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    ...jobData,
                }
            };
            const result = await jobsCollection.updateOne(query, updateDoc, options);
            res.send(result);
        })

        //save a bid data  in db
        app.post('/bid', async (req, res) => {
            const bidData = req.body;

            // check if it's a duplicate request
            const query = { email: bidData.email, jobId: bidData.jobId }
            const alreadyApplied = await bidsCollection.findOne(query);
            if (alreadyApplied) {
                return res.status(400).send('You have already placed a bid on this job')
            }
            const result = await bidsCollection.insertOne(bidData);
            res.send(result);
        });
        //save a job data  in db
        app.post('/job', async (req, res) => {
            const jobData = req.body;
            const result = await jobsCollection.insertOne(jobData);
            res.send(result);
        });

        // get all bids for a user by email
        app.get('/my-bids/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await bidsCollection.find(query).toArray();
            res.send(result);
        });

        //get all bid requests from db for a job owner
        app.get('/bid-requests/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { buyerEmail: email };
            const result = await bidsCollection.find(query).toArray();
            res.send(result);
        });
        //update bid status
        app.patch('/bid/:id', async (req, res) => {
            const id = req.params.id;
            const status = req.body;
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: status,
            };
            const options = { upsert: true }
            const result = await bidsCollection.updateOne(query, updateDoc, options);
            res.send(result)
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);
//-----------------------

app.get('/', (req, res) => {
    res.send("job hunting api running");
});

app.listen(port, () => {
    console.log('port is running on', port);
})