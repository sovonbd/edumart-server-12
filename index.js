const express = require("express");
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
// const cookieParser = require("cookie-parser");

const app = express();
const port = process.env.PORT || 5000;
// const jwtSecret = process.env.ACCESS_TOKEN_SECRET;

app.use(cors());
app.use(express.json());
// app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2dhdxvg.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("edumart").collection("users");
    const instructorCollection = client.db("edumart").collection("instructors");
    const sponsorCollection = client.db("edumart").collection("sponsors");
    const courseCollection = client.db("edumart").collection("courses");
    const paymentCollection = client.db("edumart").collection("payments");
    const quoteCollection = client.db("edumart").collection("quotes");
    const reviewCollection = client.db("edumart").collection("reviews");

    // jwt related api

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // sponsors related api

    app.get("/sponsors", async (req, res) => {
      const result = await sponsorCollection.find().toArray();
      res.send(result);
    });

    // user related api

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // instructors related api

    app.post("/instructors", async (req, res) => {
      const instructor = req.body;
      console.log(instructor);
      const result = await instructorCollection.insertOne(instructor);
      res.send(result);
    });

    // course related api

    app.get("/courses", async (req, res) => {
      const result = await courseCollection.find().toArray();
      res.send(result);
    });

    app.get("/courses/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await courseCollection.findOne(query);
      res.send(result);
    });

    // payment related api

    app.get("/payments/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { courseId: id };
      const result = await paymentCollection.findOne(query);
      res.send(result);
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      // console.log(payment);
      const result = await paymentCollection.insertOne(payment);
      res.send(result);
    });

    // quotes related api
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // quotes related api
    app.get("/quotes", async (req, res) => {
      const result = await quoteCollection.find().toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("edumart server is running");
});

app.listen(port, () => {
  console.log("edumart server listening on port", port);
});
