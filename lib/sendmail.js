const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  secure: false, // true for port 465, false for other ports
  auth: {
    user: "rjspyk5@gmail.com",
    pass: `${process.env.NODE_MAILER_PASS}`,
  },
});

const sendmail = () => {
  transporter
    .sendMail({
      from: '"Lenden" <lenden@gmail.com>',
      to: "rjspyk5@gmail.com",
      subject: "Hello ✔",
      text: "Hello world?",
      html: "<b>Hello world?</b>",
    })
    .then((res) => console.log(res))
    .catch((er) => console.log(er));
};

module.exports = { sendmail };
