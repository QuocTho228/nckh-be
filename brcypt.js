const bcrypt = require("bcrypt");
const password = "12345678";
const saltRounds = 10;

bcrypt.hash(password, saltRounds, function (err, hash) {
  if (err) throw err;
  console.log(hash);
});
