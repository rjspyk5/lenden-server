const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.omgilvs.mongodb.net/?appName=Cluster0`;
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5174", "http://localhost:5173"],
    credentials: true,
  })
);
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("server is ready");
});

// middleware
const hashedPass = async (req, res, next) => {
  const password = req.body.password;
  const hashedPassword = await bcrypt.hash(password, 10);
  req.body.password = hashedPassword;
  next();
};

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
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    // collection names
    const userCollection = client.db("lenden").collection("userCollection");

    //  login logout related api
    app.post("/reg", hashedPass, async (req, res) => {
      const data = req.body;
      const query = {
        $or: [{ email: req.body.email }, { number: req.body.number }],
      };
      // checking already registered or not
      const isAlreadyHaveAccount = await userCollection.findOne(query);
      if (isAlreadyHaveAccount) {
        return res.send({
          insertedId: null,
        });
      }
      const result = await userCollection.insertOne(data);
      res.send(result);
    });
    app.post("/login", async (req, res) => {
      const query = {
        $or: [
          { email: req.body.emailOrNumber },
          { number: req.body.emailOrNumber },
        ],
      };

      // chekcing email or number validity
      const isAnyAccountHave = await userCollection.findOne(query);
      if (!isAnyAccountHave) {
        return res.send({ result: "Haven't any account by this info" });
      }

      if (isAnyAccountHave) {
        const hashedPassword = isAnyAccountHave.password;
        // checking password
        bcrypt.compare(req.body.password, hashedPassword, (err, ress) => {
          if (err) {
            return res.send({ result: "Something Went Wrong" });
          }
          if (ress) {
            return res.send({ result: true });
          } else {
            res.send({ result: false });
          }
        });
      }
    });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => console.log("server is running"));
