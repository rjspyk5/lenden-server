const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: true,
  secure: false,
  auth: {
    user: `${process.env.NODEMAILER_USER}`,
    pass: `${process.env.NODEMAILER_PASS}`,
  },
});

const sendemail = async (to, subjectTopic, text) => {
  try {
    transporter.sendMail({
      from: '"Lenden" <lendenbd@gmail.com>',
      to: to,
      subject: `Lenden: ${subjectTopic}`,
      html: text,
    });
  } catch (error) {
    return error;
  }
};

module.exports = { sendemail };
