import express from "express";
import { v4 as uuidv4 } from "uuid";
import mtz from "moment-timezone";
import hash from "#helpers/hash";
import global from "#helpers/global";

var router = express.Router();

const genCitizenId = (lguCode) => {
  return (lguCode + uuidv4().substring(0, 8)).toUpperCase();
};

const signupvaliditor = async (req, res, next) => {
  let {
    firstName,
    middleName,
    lastName,
    suffix,
    birthdate,
    username,
    lguCode,
  } = req.body;

  try {
    let checkName = await req.db.query(
      `
      SELECT
        firstName,
        middleName,
        lastName,
        suffix,
        birthdate
      FROM
        citizen_info
      WHERE
        firstName LIKE ? AND
        COALESCE (middleName, '') LIKE ? AND
        lastName LIKE ? AND
        COALESCE (suffix, '') LIKE ? AND
        birthdate = ?
    `,
      [
        `${firstName}%`,
        !global.isEmpty(middleName) ? `${middleName}%` : "%",
        `${lastName}%`,
        !global.isEmpty(suffix) ? `${suffix}%` : "%",
        birthdate,
      ]
    );

    if (checkName.length > 0) {
      let filterMatches = checkName.filter((v) => {
        let matchName = `${v.firstName || ""}${v.middleName || ""}${
          v.lastName || ""
        }${v.suffix || ""}`.toLowerCase();
        let registrantName = `${firstName || ""}${middleName || ""}${
          lastName || ""
        }${suffix || ""}`.toLowerCase();
        return registrantName === matchName;
      });
      if (filterMatches.length > 0) {
        return res
          .status(403)
          .json({ message: `It seems that you've already registered..` });
      }
    }

    if (!global.isEmpty(username)) {
      let verifyCredential = await req.db.query(
        `
        SELECT 
          username
        FROM 
          citizen_credential
        WHERE 
          username = ?
      `,
        [username]
      );

      if (verifyCredential.length > 0) {
        return res.status(409).json({
          error: 409,
          message: `It seems the username you entered already exists.`,
        });
      }
    }

    if (!lguCode || lguCode.length !== 4)
      return res.status(400).json({ error: 400, message: "Invalid LGU Code" });

    let accountIdPassed = false;

    while (!accountIdPassed) {
      const accountId = genCitizenId(lguCode);
      let verifyAccountId = await req.db.query(
        `
        SELECT *
        FROM 
          citizen_credential
        WHERE 
          accountId = ?
      `,
        [accountId]
      );
      if (verifyAccountId.length === 0) {
        req.genAccountId = accountId;

        console.log(accountId);
        accountIdPassed = true;
      }
    }

    console.log(req.genAccountId);
    next();
  } catch (err) {
    console.error(err);
    next(err);
  }
};

router.post("/registerCitizen", signupvaliditor, async (req, res, next) => {
  let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
  let {
    firstName,
    middleName,
    lastName,
    suffix,
    birthdate,
    sex,
    email,
    mobileNumber,
    username,
    password,
  } = req.body;

  try {
    console.log(req.genAccountId);
    let val = JSON.stringify({ ...req.body, accountId: req.genAccountId });
    let npass = await hash.hashPassword(password);

    let result = await req.db.query(
      `
        CALL citizen_registration_v2(
          ?, ?, ?, ?, ?, 
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?
        )`,
      [
        req.genAccountId,
        firstName,
        middleName,
        lastName,
        suffix,
        birthdate,
        sex,
        email || "no-email@gmail.com",
        mobileNumber,
        username,
        npass,
        date,
        date,
        val,
      ]
    );
    let results = result[0];
    if (results.length > 0) {
      return res
        .status(200)
        .json({ data: results[0], message: `Successfully Signed Up.` });
    } else {
      return res.status(500).json({ error: 500, message: `Failed to signup.` });
    }
  } catch (err) {
    console.error(err);
    if (err.code == "ER_DUP_ENTRY") {
      let msg = err.message.split("for")[0];
      return res.status(400).json({ error: 400, message: msg.trim() });
    }
    next(err);
  }
});

export default router;
