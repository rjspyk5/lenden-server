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
const { formatedTime, formatedDate } = require("./lib/formatedTime.js");

// middlewares
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5174",
      "http://localhost:5173",
      "https://lendenbdd.web.app",
      "https://lendenbdd.firebaseapp.com",
    ],
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
                balance: isAnyAccountHave?.amount,
                number: isAnyAccountHave?.number,
              },
            });
          } else {
            res.send({ result: "Password Didn't match" });
          }
        });
      }
    });
    // all user
    app.get("/users", async (req, res) => {
      const option = {
        projection: {
          name: 1,
          email: 1,
          role: 1,
          number: 1,
          accountStatus: 1,
          amount: 1,
        },
      };
      const result = await userCollection.find({}, option).toArray();
      const data = result.map((el) => {
        return {
          _id: el._id,
          name: el.name,
          number: el.number,
          email: el.email,
          role: el.role,
          amount: el.amount,
          accountStatus: el.accountStatus,
        };
      });
      res.send(data);
    });
    // checkUser api
    app.get("/user", async (req, res) => {
      const emailOrNumber = req.query?.emailOrNumber;
      const query = {
        $or: [{ email: emailOrNumber }, { number: emailOrNumber }],
      };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.post("/transactions", async (req, res) => {
      const password = req.body.pin;
      let ReciverNumber = req.body.number;
      let senderNumber = req.body.senderNumber;
      const amount = parseInt(req.body.amount);
      const method = req.body.method;
      const date = new Date();

      // find own account database
      const senderDetailsFromDatabase = await userCollection.findOne({
        number: senderNumber,
      });

      // find receiverAccountDetails from database
      const receiverAccountDetailsFromDatabase = await userCollection.findOne({
        number: ReciverNumber,
      });

      // password verification process
      const hashedPass = senderDetailsFromDatabase.password;
      bcrypt.compare(password, hashedPass, (er, ress) => {
        // wrong password will go back from here
        if (!ress) {
          return res.send({ result: "Password didn't match" });
        }
        // if password correct then this operation execute
        else {
          afterPasswordVerification();
        }
      });

      const afterPasswordVerification = async () => {
        // Balance Check if deposit or payment money without charge
        if (
          method === "deposit_money" ||
          method === "payment " ||
          method === "cash_in"
        ) {
          if (senderDetailsFromDatabase?.amount < amount) {
            if (method === "deposit_money") {
              return res.send({
                result: "Currently haven't enough money to give you",
              });
            }
            return res.send({ result: "Insufficent Balance" });
          }
        }

        // balance check if cash in
        if (method === "cash_in") {
          if (receiverAccountDetailsFromDatabase?.amount < amount) {
            return res.send({
              result: "Currently haven't enough money to give you",
            });
          }
        }
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
        if (method === "cash_in" || method === "deposit_money") {
          ReciverNumber = req.body.senderNumber;
          senderNumber = req.body.number;
        }

        const transictionHistory = {
          senderNumber,
          ReciverNumber,
          date,
          amount: req.body.amount,
          method: req.body.method,
        };

        // set charge and status based on method
        let charge = 0;
        transictionHistory.status = "pending";
        let updateDocForSender;
        let updateDocForReceiver;
        if (method === "cash_out") {
          charge = amount * 1.015 - amount;
          transictionHistory.status = "success";
          updateDocForSender = {
            $inc: {
              amount: -(amount + charge),
            },
          };
          updateDocForReceiver = {
            $inc: {
              amount: amount,
            },
          };
        }
        if (method === "send_money") {
          amount < 99 ? (charge = 0) : (charge = 5);
          transictionHistory.status = "success";
          updateDocForSender = {
            $inc: {
              amount: -(amount + charge),
            },
          };
          updateDocForReceiver = {
            $inc: {
              amount: amount,
            },
          };
        }

        if (method === "payment") {
          transictionHistory.status = "success";
          updateDocForSender = {
            $inc: {
              amount: -amount,
            },
          };
          updateDocForReceiver = {
            $inc: {
              amount: amount,
            },
          };
        }

        transictionHistory.charge = charge;

        //todo: Here need to decided that admin will get money or not if admin get money then i will add it in admin balance and agent will get also some money

        // make universel api for cash in ,add money,withdraw

        if (
          method === "cash_in" ||
          method === "deposit_money" ||
          method === "withdraw_money"
        ) {
          const result3 = await transictionHistoryCollection.insertOne(
            transictionHistory
          );

          return res.send({ result3 });
        }
        // if send Money or cashout then it will run
        else {
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
          return res.send({ result, result2, result3 });
        }
      };
    });
    // api for get pending send_money,cash_out etc related data get to use this give number as params and give method without qutation as query http://localhost:5000/pendingreq/01684883865?method=send_money
    app.get("/pendingreq/:number", async (req, res) => {
      const agentNumber = req.params?.number;
      const method = req.query?.method;
      // todo: method onujai query er vhitor senderNumber change korte hbe
      const number =
        method === "withdraw_money"
          ? { ReciverNumber: agentNumber }
          : { senderNumber: agentNumber };
      const query = {
        $and: [
          number,
          { method: method },
          {
            status: "pending",
          },
        ],
      };
      const result = await transictionHistoryCollection.find(query).toArray();
      res.send(result);
    });
    // api for update cashin req and cash out req . Here have to send id as params and "pending"/"cancel" status query
    // example api     `http://localhost:5000/pendingreq/${id}?status=${action}&sender=${sender}&rcver=${rcver}&amount=${amount}`
    app.patch("/pendingreq/:id", async (req, res) => {
      const id = req.params.id;
      const statusType = req.query.status;
      const senderNumber = req.query.sender;
      const recver = req.query.rcver;
      const amount = parseInt(req.query.amount);
      const senderQuery = { number: senderNumber };
      const updateDocSender = {
        $inc: {
          amount: -amount,
        },
      };
      const rcvrQuery = { number: recver };
      const updateDocRcvr = {
        $inc: {
          amount: amount,
        },
      };
      const query = { _id: new ObjectId(id) };
      const updateDocForHistory = {
        $set: {
          status: statusType,
        },
      };

      if (statusType === "cancel") {
        const result = await transictionHistoryCollection.updateOne(
          query,
          updateDocForHistory
        );
        res.send({ result });
      } else {
        const result = await transictionHistoryCollection.updateOne(
          query,
          updateDocForHistory
        );
        const result2 = await userCollection.updateOne(
          rcvrQuery,
          updateDocRcvr
        );
        const result3 = await userCollection.updateOne(
          senderQuery,
          updateDocSender
        );
        res.send({ result, result2, result3 });
      }
    });

    // History api
    // example query http://localhost:5000/history?method=send_money&number=01684883865
    app.get("/history", async (req, res) => {
      const number = req?.query?.number || null;
      const method = req?.query?.method || null;
      let query = {
        $or: [{ senderNumber: number }, { ReciverNumber: number }],
      };
      if (method) {
        query = {
          method: method,
          $or: [{ senderNumber: number }, { ReciverNumber: number }],
        };
      }
      let result;

      if (number) {
        result = await transictionHistoryCollection
          .find(query)
          .sort({ date: -1 })
          .toArray();
      } else {
        result = await transictionHistoryCollection
          .find()
          .sort({ date: -1 })
          .toArray();
      }

      const data = result.map((el) => {
        return {
          _id: el._id,
          senderNumber: el.senderNumber,
          ReciverNumber: el.ReciverNumber,
          amount: el.amount,
          charge: parseFloat(el.charge.toFixed(2)),
          method: el.method,
          date: el.date ? formatedDate(el?.date) : null,
          time: el.date ? formatedTime(el?.date) : null,
          status: el.status,
        };
      });
      return res.send(data);
    });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port);
