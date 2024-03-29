const express = require("express");
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const { startOfToday, endOfDay } = require("date-fns");
// const cookieParser = require("cookie-parser");

const app = express();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
    // await client.connect();

    const userCollection = client.db("edumart").collection("users");
    const instructorCollection = client.db("edumart").collection("instructors");
    const sponsorCollection = client.db("edumart").collection("sponsors");
    const courseCollection = client.db("edumart").collection("courses");
    const paymentCollection = client.db("edumart").collection("payments");
    const assignmentCollection = client.db("edumart").collection("assignments");
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

    // middlewares

    const verifyToken = (req, res, next) => {
      // console.log(req.headers);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      // console.log(token);
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
      });
      next();
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req?.decoded?.email;
      console.log("verify admin", email);
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // sponsors related api

    app.get("/sponsors", async (req, res) => {
      const result = await sponsorCollection.find().toArray();
      res.send(result);
    });

    // user related api

    app.get("/users", verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      // console.log(email);

      // Check if the decoded email matches the request email
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      // Use the decoded email to query the user collection
      const query = { email: req.decoded.email };
      const user = await userCollection.findOne(query);

      // Check if the user exists and has the role of an admin
      if (user && user.role === "admin") {
        res.send({ admin: true });
      } else {
        res.send({ admin: false });
      }
    });

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

    app.patch("/users/:instructor", async (req, res) => {
      const instructorName = req.params.instructor;
      const body = req.body;
      // console.log(instructorName, body);
      const filter = { name: instructorName };
      const updateDoc = {
        $set: {
          role: body.role,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc, {
        upsert: false,
      });
      res.send({ result, name: instructorName });
    });

    // instructors related api
    app.get("/instructors", verifyToken, verifyAdmin, async (req, res) => {
      const result = await instructorCollection.find().toArray();
      res.send(result);
    });

    app.get("/instructors/:name", verifyToken, async (req, res) => {
      const name = req.params.name;
      // console.log(name);
      const query = { instructor: name };
      const result = await instructorCollection.findOne(query);
      res.send(result);
    });

    app.patch("/instructors/:name", async (req, res) => {
      const name = req.params.name;
      const body = req.body;
      // console.log(name, body);
      const filter = { instructor: name };
      const updateDoc = {
        $set: {
          ...(body.status && { status: body.status }),
        },
      };
      const result = await instructorCollection.updateMany(filter, updateDoc);
      res.send({ result, name });
    });

    app.post("/instructors", async (req, res) => {
      const instructor = req.body;
      console.log(instructor);
      const result = await instructorCollection.insertOne(instructor);
      res.send(result);
    });

    // course related api

    app.get("/courses", async (req, res) => {
      const query = { status: "Accepted" };
      // console.log(req.query);
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const result = await courseCollection.find(query).toArray();
      let resultAll;
      if (page === 1) {
        resultAll = await courseCollection.find().limit(size).toArray();
      } else {
        resultAll = await courseCollection
          .find()
          .skip((page - 1) * size)
          .limit(size)
          .toArray();
      }
      res.send({ result, resultAll });
    });

    app.get("/totalCourses", async (req, res) => {
      const count = await courseCollection.estimatedDocumentCount();
      res.send({ count });
    });

    app.get("/courses/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await courseCollection.findOne(query);
      res.send(result);
    });

    app.get("/courses/user/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      // console.log(email);
      const query = { email: email };
      const result = await courseCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/courses", async (req, res) => {
      const course = req.body;
      // console.log(typeof course.price);
      const result = await courseCollection.insertOne(course);
      res.send(result);
    });

    app.patch("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const updatedCourse = req.body;
      console.log(id, updatedCourse);
      const existingCourse = await courseCollection.findOne({
        _id: new ObjectId(id),
      });

      const currentNumOfTotalEnrollment =
        existingCourse.numOfTotalEnrollment || 0;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          ...(updatedCourse.title && { title: updatedCourse.title }),
          ...(updatedCourse.price && { price: updatedCourse.price }),
          ...(updatedCourse.description && {
            description: updatedCourse.description,
          }),
          ...(updatedCourse.image && { image: updatedCourse.image }),
          ...(updatedCourse.status && { status: updatedCourse.status }),
          ...(updatedCourse.numOfTotalEnrollment && {
            numOfTotalEnrollment:
              currentNumOfTotalEnrollment + updatedCourse.numOfTotalEnrollment,
          }),
        },
      };
      const result = await courseCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/courses/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await courseCollection.deleteOne(query);
      res.send(result);
    });

    // assignments related api

    app.get("/assignments/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { courseId: id };

      const totalAssignmentSubmitted = await assignmentCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalSubmitted: {
                $sum: "$submitted",
              },
            },
          },
        ])
        .toArray();
      const result1 =
        totalAssignmentSubmitted.length > 0
          ? totalAssignmentSubmitted[0].totalSubmitted
          : 0;

      console.log(result1);

      const result = await assignmentCollection.find(query).toArray();
      res.send({ result, result1 });
    });

    app.post("/assignments", async (req, res) => {
      const body = req.body;
      console.log("Incoming request body:", body);
      const result = await assignmentCollection.insertOne(body);
      res.send(result);
    });

    app.patch("/assignments/:id", async (req, res) => {
      const id = req.params.id;
      const updatedAssignment = req.body;
      console.log(id, updatedAssignment.submitted);
      const existingAssignment = await assignmentCollection.findOne({
        _id: new ObjectId(id),
      });

      // console.log(existingAssignment);

      let existingAssignmentSubmitted = 0;
      if (existingAssignment && existingAssignment.submitted !== undefined) {
        existingAssignmentSubmitted = existingAssignment.submitted;
      }

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          submitted:
            (existingAssignmentSubmitted || 0) +
            (updatedAssignment.submitted || 0),
        },
      };
      console.log(existingAssignmentSubmitted);

      const result = await assignmentCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // stats related api

    app.get("/stats", async (req, res) => {
      const totalUsers = await userCollection.estimatedDocumentCount();
      const totalCourses = await courseCollection.estimatedDocumentCount();
      const allUsers = await userCollection.find().toArray();

      // Filter the courses to count learners and teachers
      const totalLearners = allUsers.filter(
        (course) => course.role !== "admin" && course.role !== "Teacher"
      ).length;

      const totalTeachers = allUsers.filter(
        (course) => course.role === "Teacher"
      ).length;

      // console.log(totalUsers, totalCourses, totalLearners, totalTeachers);

      res.send({
        totalUsers,
        totalCourses,
        totalLearners,
        totalTeachers,
      });
    });

    // payment related api

    app.get("/payments/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      // console.log(email);
      const query = { learnerEmail: email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      if (!price || isNaN(price)) {
        return res.status(400).send({ error: "Invalid price" });
      }

      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "cad",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
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

    app.get("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      const query = { courseId: id };
      const result = await reviewCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/reviews", async (req, res) => {
      const body = req.body;
      // console.log(body);
      const result = await reviewCollection.insertOne(body);
      res.send(result);
    });

    // quotes related api
    app.get("/quotes", async (req, res) => {
      const result = await quoteCollection.find().toArray();
      res.send(result);
    });

    // search api

    // app.get("/courses/:search", async (req, res) => {
    //   try {
    //     const search = req.params.search;

    //     console.log(title);

    //     // Check if the 'title' query parameter is provided
    //     if (!title || typeof title !== "string") {
    //       return res.status(400).json({ error: "Invalid search query" });
    //     }

    //     // Case-insensitive search using a regular expression
    //     const searchRegex = new RegExp(title, "i");

    //     // Search for courses by title
    //     const matchedCourses = await courseCollection
    //       .find({ title: { $regex: searchRegex } })
    //       .toArray();

    //     console.log(matchedCourses);

    //     res.send({ results: matchedCourses });
    //   } catch (error) {
    //     console.error("Error searching courses:", error);
    //     res.status(500).json({ error: "Error searching courses" });
    //   }
    // });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
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
