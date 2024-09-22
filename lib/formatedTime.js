const formatedTime = (date) => {
  let hours = date.getHours();
  let minutes = date.getMinutes();

  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  minutes = minutes < 10 ? "0" + minutes : minutes; // Add leading zero if minutes are less than 10

  return `${hours}:${minutes} ${ampm}`;
};

const formatedDate = (date) => {
  const options = { day: "numeric", month: "short", year: "numeric" };
  return date.toLocaleDateString("en-GB", options); // Format: 22 Sep 2024
};

module.exports = { formatedTime, formatedDate };
