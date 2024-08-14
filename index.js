const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { hashedPass, verifyToken } = require("./middleware.js");

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
    const transictionHistoryCollection = client
      .db("lenden")
      .collection("transictionHistoryCollection");

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
      const amount = parseInt(req.body.amount);
      const method = req.body.method;
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
      });

      // Balance Check if send money
      if (method === "send_money") {
        if (
          senderDetailsFromDatabase?.amount < amount ||
          (amount > 99 && senderDetailsFromDatabase?.amount < amount + 5)
        ) {
          return res.send({ result: "Insufficent Balance" });
        }
      }
      // Balance Check if cahsout
      if (method === "cash_out") {
        if (senderDetailsFromDatabase?.amount < amount * 1.015) {
          return res.send({ result: "Insufficent Balance" });
        }
      }

      // data created for pusing on database
      const transictionHistory = {
        senderNumber,
        ReciverNumber,
        amount: req.body.amount,
        method: req.body.method,
      };

      // set charge and status based on method
      let charge;
      if (method === "cash_out") {
        charge = amount * 1.015 - amount;
        transictionHistory.status = "success";
      }
      if (method === "send_money") {
        amount < 99 ? (charge = 0) : (charge = 5);
        transictionHistory.status = "success";
      }
      transictionHistory.charge = charge;
      // const ReciverTransictionHistory = {
      //   transictionId,
      //   senderNumber,
      //   amount: req.body.amount,
      //   method: "received_money",
      // };

      // const SenderTransictionHistory = {
      //   transictionId,
      //   ReciverNumber,
      //   method: method,
      //   amount: req.body.amount,
      //   charge,
      // };

      const updateDocForSender = {
        $inc: {
          amount: -(amount + charge),
        },
        // $push: { transictionHistory: SenderTransictionHistory },
      };

      //todo: Here need to decided that admin will get money or not if admin get money then i will add it in admin balance and agent will get also some money

      const updateDocForReceiver = {
        $inc: {
          amount: amount,
        },
        // $push: { transictionHistory: ReciverTransictionHistory },
      };

      const result3 = await transictionHistoryCollection.insertOne(
        transictionHistory
      );

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
      console.log(result, result2, result3);
    });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => console.log("server is running"));
