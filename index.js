const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.omgilvs.mongodb.net/?appName=Cluster0`;

// middlewares
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5174", "http://localhost:5173"],
    credentials: true,
  })
);
app.use(cookieParser());

//custom middleware
const hashedPass = async (req, res, next) => {
  const password = req.body.password;
  const hashedPassword = await bcrypt.hash(password, 10);
  req.body.password = hashedPassword;
  next();
};

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "Not authorized" });
  }
  jwt.verify(token, process.env.token, (er, decoded) => {
    if (er) {
      res.status(401).send({ message: "unauthorized" });
    }
    req.user = decoded;
    next();
  });
};

// database connection
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();
    // await client.db("admin").command({ ping: 1 });
    // collection names
    const userCollection = client.db("lenden").collection("userCollection");

    const cookieOptions = {
      httpOnly: true,
      secqure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    };
    // jwt related token
    app.post("/jwt", async (req, res) => {
      const userEmail = req.body;
      const token = jwt.sign(userEmail, process.env.token, { expiresIn: "7d" });
      res.cookie("token", token, cookieOptions).send({ success: true });
    });
    app.post("/logout", async (req, res) => {
      res
        .clearCookie("token", { ...cookieOptions, maxAge: 0 })
        .send({ success: true });
    });
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
            return res.send({
              result: true,
              data: {
                name: isAnyAccountHave.name,
                email: isAnyAccountHave?.email,
                photo: isAnyAccountHave.photo,
                accountStats: isAnyAccountHave.status,
                role: isAnyAccountHave?.role,
              },
            });
          } else {
            res.send({ result: "Password Didn't match" });
          }
        });
      }
    });
    app.get("/checkrole", async (req, res) => {
      const emailOrNumber = req.query?.emailOrNumber;
      const query = {
        $or: [{ email: emailOrNumber }, { number: emailOrNumber }],
      };
      const options = {
        projection: { role: 1, name: 1, number: 1 },
      };
      const result = await userCollection.findOne(query, options);
      res.send(result);
    });

    app.post("/sendmoney", async (req, res) => {
      const password = req.body.pin;
      const ReciverNumber = req.body.number;
      const senderNumber = req.body.senderNumber;
      // find own account database
      const senderDetailsFromDatabase = await userCollection.findOne({
        number: senderNumber,
      });
      // find receiverAccountDetails from database
      const receiverAccountDetailsFromDatabase = await userCollection.findOne({
        number: ReciverNumber,
      });
      // password verification
      const hashedPass = senderDetailsFromDatabase.password;
      bcrypt.compare(password, hashedPass, (er, ress) => {
        if (!ress) {
          return res.send({ result: "password didn't match" });
        }
        if (senderDetailsFromDatabase?.amount < req.body.amount) {
          console.log(senderDetailsFromDatabase.amount, "database amount");
          console.log(req.body.amount, "sending amount");
          return res.send({ result: "Insufficent Amount" });
        }
      });

      const allTransictiorHistory = {
        senderNumber,
        ReciverNumber,
        amount: req.body.amount,
        method: req.body.method,
      };
      const ReciverTransictionHistory = {
        senderNumber,
        amount: req.body.amount,
        method: "received_money",
      };
      const SenderTransictionHistory = {
        ReciverNumber,
        method: "send_money",
        amount: req.body.amount,
      };

      const updateDocForSender = {
        $set: {
          amount:
            parseInt(senderDetailsFromDatabase.amount) -
            parseInt(req.body.amount),
        },
        $push: { transictionHistory: SenderTransictionHistory },
      };

      const updateDocForReceiver = {
        $set: {
          amount:
            parseInt(receiverAccountDetailsFromDatabase.amount) +
            parseInt(req.body.amount),
        },
        $push: { transictionHistory: ReciverTransictionHistory },
      };

      const result = await userCollection.updateOne(
        {
          number: senderNumber,
        },
        updateDocForSender
      );
      const result2 = await userCollection.updateOne(
        { number: ReciverNumber },
        updateDocForReceiver
      );
      console.log(result, result2);
    });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => console.log("server is running"));
