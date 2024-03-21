import express from "express";

import Controller from "#cms_ctrl/election/auth.controller";

const controller = new Controller();
var router = express.Router();

router.use((req, res, next) => {
  // -----------------------------------------------------------------------
  const auth = { login: "dgbrgy", password: "dgbrgy2023@!" }; // change this

  // parse login and password from headers
  const b64auth = (req.headers.authorization || "").split(" ")[1] || "";
  const [login, password] = Buffer.from(b64auth, "base64")
    .toString()
    .split(":");
  // Verify login and password are set and correct
  if (login && password && login === auth.login && password === auth.password) {
    // Access granted...
    return next();
  }

  // Access denied...
  res.set("WWW-Authenticate", 'Basic realm="401"'); // change this
  res.status(401).send("Authentication required."); // custom message

  // -----------------------------------------------------------------------
});

router.use("/getCitizenRecord", controller.getCitizenRecord);

export default router;
