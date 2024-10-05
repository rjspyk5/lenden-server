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
const { sendemail } = require("./lib/sendMail");
const { messageGenarator } = require("./lib/messageGenarator");

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
    const notificationCollection = client
      .db("lenden")
      .collection("notificationCollection");

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
      data.amount = 50;

      if (data.role === "agent") {
        data.income = 1000;
        data.expense = 0;
        data.amount = 1000;
      }
      const updateDoc = {
        $inc: {
          expense: data.amount,
          amount: -data.amount,
        },
      };
      const adminExpenseUpdate = await userCollection.updateOne(
        {
          role: "admin",
        },
        updateDoc
      );
      if (data?.email) {
        sendemail(
          data?.email,
          "Account Created",
          `You Have been successfully created ${data.role} account.You have got reg bonus ${data.amount} tk`
        );
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
        // data created for pusing on database
        if (method === "cash_in" || method === "deposit_money") {
          ReciverNumber = req.body.senderNumber;
          senderNumber = req.body.number;
        }

        const transictionHistory = {
          senderNumber,
          ReciverNumber,
          date,
          amount: parseInt(req.body.amount),
          method: req.body.method,
        };

        // make object for notificationHistory it will pass after succefull transition entry
        const senderNotification = {
          status: "unread",
          number: senderNumber,
          date: date,
        };
        const receiverNotification = {
          status: "unread",
          number: ReciverNumber,
          date: date,
        };

        // Balance Check if deposit or payment money without charge
        if (
          method === "deposit_money" ||
          method === "payment" ||
          method === "cash_in" ||
          method === "withdraw_money"
        ) {
          if (senderDetailsFromDatabase?.amount < amount) {
            if (method === "deposit_money") {
              senderNotification.number =
                receiverAccountDetailsFromDatabase.number;
              receiverNotification.number = senderDetailsFromDatabase.number;
              return res.send({
                result: "Currently haven't enough money to give you",
              });
            }
            return res.send({ result: "Insufficent Balance" });
          }
        }
        // balance check if withdraw
        if (method === "withdraw_money") {
          if (senderDetailsFromDatabase.role === "agent") {
            if (senderDetailsFromDatabase?.amount < amount * 1.001) {
              return res.send({ result: "Insufficent Balance" });
            }
          } else {
            if (senderDetailsFromDatabase?.amount < amount * 1.005) {
              return res.send({ result: "Insufficent Balance" });
            }
          }
        }
        // balance check if cash in
        if (method === "cash_in") {
          senderNotification.number = receiverAccountDetailsFromDatabase.number;
          receiverNotification.number = senderDetailsFromDatabase.number;
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
              amount: amount + charge / 2,
              income: charge / 2,
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
        // confusing sender and reciver related variable confiustion clearing
        const senderOldBalance =
          method === "cash_in" || method === "deposit_money"
            ? receiverAccountDetailsFromDatabase.amount
            : senderDetailsFromDatabase.amount;
        const recvrOldBalance =
          method === "cash_in" || method === "deposit_money"
            ? senderDetailsFromDatabase.amount
            : receiverAccountDetailsFromDatabase.amount;
        const senderEmail =
          method === "cash_in" || method === "deposit_money"
            ? receiverAccountDetailsFromDatabase.email
            : senderDetailsFromDatabase.email;
        const recvrEmail =
          method === "cash_in" || method === "deposit_money"
            ? senderDetailsFromDatabase.email
            : receiverAccountDetailsFromDatabase.email;

        //todo: Here need to decided that admin will get money or not if admin get money then i will add it in admin balance and agent will get also some money
        transictionHistory.adminIncome = charge === 0 ? 0 : charge / 2;
        transictionHistory.agentIncome = charge === 0 ? 0 : charge / 2;

        // make universel api for cash in ,add money,withdraw

        // if have to accept type req
        if (
          method === "cash_in" ||
          method === "deposit_money" ||
          method === "withdraw_money"
        ) {
          const result3 = await transictionHistoryCollection.insertOne(
            transictionHistory
          );

          const msz = messageGenarator(
            method,
            senderNumber,
            charge,
            amount,
            result3?.insertedId.toString(),
            formatedDate(date),
            formatedTime(date),
            senderOldBalance,
            recvrOldBalance,
            ReciverNumber
          );
          senderNotification.message = msz.senderMessage;
          senderNotification.trxid = result3?.insertedId;
          receiverNotification.trxid = result3?.insertedId;
          receiverNotification.message = msz.receiverMessage;
          sendemail(senderEmail, "Transition Update", msz.senderMessage);
          sendemail(recvrEmail, "Transition Update", msz.receiverMessage);
          const notificationResult = await notificationCollection.insertMany([
            senderNotification,
            receiverNotification,
          ]);

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
          // admin Profit Logic
          const income = method === "send_money" ? charge : charge / 2;
          const adminIncomeUpdate = await userCollection.updateOne(
            { role: "admin" },
            { $inc: { income: income, amount: income } }
          );
          // Sending email to sender and receiver

          const msz = messageGenarator(
            method,
            senderNumber,
            charge,
            amount,
            result3?.insertedId.toString(),
            formatedDate(date),
            formatedTime(date),
            senderOldBalance,
            recvrOldBalance,
            ReciverNumber
          );
          senderNotification.message = msz.senderMessage;
          senderNotification.trxid = result3?.insertedId;
          receiverNotification.trxid = result3?.insertedId;
          receiverNotification.message = msz.receiverMessage;
          sendemail(senderEmail, "Transition Update", msz.senderMessage);
          sendemail(recvrEmail, "Transition Update", msz.receiverMessage);
          const notificationResult = notificationCollection.insertMany([
            senderNotification,
            receiverNotification,
          ]);

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
      const method = req.query?.method;

      const query = { _id: new ObjectId(id) };
      const updateDocForHistory = {
        $set: {
          status: statusType,
        },
      };

      if (statusType === "cancel") {
        // if cancel then it will stop here
        const result = await transictionHistoryCollection.updateOne(
          query,
          updateDocForHistory
        );
        res.send({ result });
      } else {
        // if approve then work here

        const senderQuery = { number: senderNumber };
        const rcvrQuery = { number: recver };
        const senderDetailsFromDatabase = await userCollection.findOne(
          senderQuery
        );

        const updateDocSender = {
          $inc: {
            amount: -amount,
          },
        };

        const updateDocRcvr = {
          $inc: {
            amount: amount,
          },
        };

        //if withdraw then Admin Profit and Agent and Marchent expense logic

        if (method) {
          // 0.5% expense if marchent
          let expensePercentage = 1.005;
          if (senderDetailsFromDatabase.role === "agent") {
            // 0.01% expense if agent
            expensePercentage = 1.001;
            // const senderExpenseUpdate = await userCollection.updateOne(
            //   { number: senderDetailsFromDatabase.number },
            //   { $inc: { expense: -(amount * expensePercentage) } }
            // );
            updateDocSender.$inc.expense = amount * expensePercentage - amount;
            updateDocSender.$inc.amount = -(amount * expensePercentage);
          }
          updateDocRcvr.$inc.income = amount * expensePercentage - amount;
          updateDocRcvr.$inc.amount = amount * expensePercentage;
        }

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
    // example query http://localhost:5000/notifications/01798565378
    app.get("/notifications/:number", async (req, res) => {
      const number = req.params.number;
      const result = await notificationCollection
        .find({ number: number }, { projection: { message: 1, status: 1 } })
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    app.get("/agentdashboard/:number", async (req, res) => {
      const userNumber = req.params.number;
      const agentIncomeExpense = await userCollection.findOne(
        { number: userNumber },
        { projection: { amount: 1, income: 1, expense: 1 } }
      );

      const result = await transictionHistoryCollection
        .aggregate([
          {
            $match: {
              $or: [
                { senderNumber: userNumber },
                { ReciverNumber: userNumber },
              ],
            },
          },
          {
            $project: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, // Format the date
              amount: {
                $cond: {
                  if: { $isNumber: "$amount" },
                  then: "$amount",
                  else: { $toDouble: "$amount" }, // Convert to number if it's a string
                },
              },
            },
          },
          {
            $group: {
              _id: "$date", // Group by formatted date
              totalAmount: { $sum: "$amount" }, // Sum the amounts (ensured as numbers)
            },
          },
          {
            $sort: { _id: 1 }, // Sort by date in ascending order
          },
        ])
        .toArray();

      const prices = result.map((item) => item.totalAmount);
      const dates = result.map((item) => item._id);
      const agentGraphData = { prices, dates };

      res.send({ agentIncomeExpense, agentGraphData });
    });
    app.get("/admindashboard", async (req, res) => {
      try {
        // Get total withdrawal for a specific admin number
        const withdraw = await transictionHistoryCollection
          .aggregate([
            {
              $match: {
                method: "withdraw_money",
                ReciverNumber: "01684883865",
              },
            },
            {
              $group: {
                _id: null,
                totalAmount: { $sum: "$amount" },
              },
            },
          ])
          .toArray();

        // Get total deposit for a specific admin number
        const deposit = await transictionHistoryCollection
          .aggregate([
            {
              $match: {
                method: "deposit_money",
                senderNumber: "01684883865",
              },
            },
            {
              $group: {
                _id: null,
                totalAmount: { $sum: "$amount" },
              },
            },
          ])
          .toArray();

        // Get the top 3 user balances
        const topBalances = await userCollection
          .find({}, { projection: { amount: 1, name: 1, number: 1 } })
          .sort({ amount: -1 })
          .limit(3)
          .toArray();

        // Get daily transaction totals
        const result = await transictionHistoryCollection
          .aggregate([
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                totalAmount: { $sum: "$amount" },
              },
            },
            {
              $sort: { _id: 1 },
            },
          ])
          .toArray();

        // Get last 3 transactions
        const transactions = await transictionHistoryCollection
          .find({})
          .sort({ date: -1 })
          .limit(3)
          .toArray();
        // Extract prices and dates for transition graph
        const prices = result.map((item) => item.totalAmount);
        const dates = result.map((item) => item._id);
        const transitionGraph = { prices, dates };

        // Admin user details
        const userDetails = await userCollection.findOne({ role: "admin" });
        const totalWithdraw = withdraw[0]?.totalAmount || 0;
        const totalDeposit = deposit[0]?.totalAmount || 0;
        const income = userDetails?.income || 0;
        const expense = userDetails?.expense || 0;
        const profit = income - expense;

        // User stats
        const allUser = await userCollection.countDocuments();
        const pending = await userCollection.countDocuments({
          accountStatus: "pending",
        });
        const approved = await userCollection.countDocuments({
          accountStatus: "approved",
        });

        // Send all the data to the frontend
        res.send({
          totalWithdraw,
          totalDeposit,
          topBalances,
          transitionGraph,
          transactions,
          totalUsers: allUser,
          pendingUsers: pending,
          approvedUsers: approved,
          income,
          expense,
          profit,
        });
      } catch (error) {
        console.error("Error in /admindashboard:", error);
        res.status(500).send({ error: "Failed to load dashboard data" });
      }
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port);
