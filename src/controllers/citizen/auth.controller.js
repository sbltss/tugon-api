import moment from "moment";
import mtz from "moment-timezone";
import jwt, { decode } from "jsonwebtoken";
import uniqid from "uniqid";
import randomize from "randomatic";
import { unescape, isEmpty } from "lodash";
import hash from "#helpers/hash";
import SendGrid from "#helpers/sendgrid";
import OTP from "#helpers/otp";
import global from "#helpers/global";
import { v4 as uuidv4 } from "uuid";
import audit from "#helpers/audit";

let sendgrid = new SendGrid();
let otp = new OTP();
let jwtSecret =
  process.env.NODE_ENV === "development"
    ? process.env.jwtSecretKey
    : process.env.jwtSecretKeyProd;

let getOtherInfo = async (req, accountId) => {
  try {
    let info = await req.db.query(
      `
        SELECT 
          accountId,
          firstName,
          middlename,
          lastName,
          suffix,
          birthdate,
          sex,
          familyCode
        FROM citizen_info
        WHERE
          accountId = ?
      `,
      [accountId]
    );
    let contacts = await req.db.query(
      `
        SELECT 
          primaryEmail,
          tempEmail,
          primaryMobile,
          tempMobile
        FROM citizen_contacts
        WHERE
          accountId = ?
      `,
      [accountId]
    );
    let profileStatus = await req.db.query(
      `
        SELECT 
          accountId,
          services,
          status
        FROM citizen_verifystatus
        WHERE
          accountId = ? AND 
          services = ? AND
          isDeleted = ?
      `,
      [accountId, "PROFILE", 0]
    );

    info[0].contacts = contacts;
    info[0].status = profileStatus[0].status;

    return info;
  } catch (err) {
    next(err);
  }
};

const genCitizenId = (lguCode) => {
  return (lguCode + uuidv4().substring(0, 8)).toUpperCase();
};

export default class Controller {
  async getBrgy(req, res, next) {
    try {
      let result = await req.db.query(`
        SELECT * FROM brgy
      `);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    let { username, password } = req.body;

    try {
      let result = await req.db.query(
        `SELECT * FROM citizen_credential WHERE username = ?`,
        [username]
      );

      if (result.length > 0) {
        if (result[0].isDeleted == 1) {
          return res.status(401).json({
            error: 401,
            message:
              "This account was already deactivated. Please contact support to re-activate your account.",
          });
        }

        if (!(await hash.comparePassword(password, result[0].password))) {
          return res.status(400).json({
            error: 400,
            message: "Invalid credentials. Please try again.",
          });
        }
        let info = await req.db.query(
          `
          SELECT 
            accountId
          FROM citizen_info
          WHERE
            accountId = ?
        `,
          [result[0].accountId]
        );

        // let contacts = await req.db.query(
        //   `
        //   SELECT
        //     primaryEmail,
        //     tempEmail,
        //     primaryMobile,
        //     tempMobile
        //   FROM citizen_contacts
        //   WHERE
        //     accountId = ?
        // `,
        //   [result[0].accountId]
        // );
        // let profileStatus = await req.db.query(
        //   `
        //   SELECT
        //     accountId,
        //     services,
        //     status
        //   FROM citizen_verifystatus
        //   WHERE
        //     accountId = ? AND
        //     services = ? AND
        //     isDeleted = ?
        // `,
        //   [result[0].accountId, "PROFILE", 0]
        // );

        // info[0].contacts = contacts;
        // info[0].status = profileStatus[0].status;
        let results = {
          accountId: result[0].accountId,
        };
        let payload = JSON.parse(JSON.stringify(results));
        let token = jwt.sign(payload, jwtSecret, {
          expiresIn: "365d",
        });
        console.log(info);
        return res.status(200).json({ token: token });
      } else {
        return res.status(401).json({
          error: 401,
          message: "User does not exists. Please try again.",
        });
      }
    } catch (err) {
      console.log(err);
      next(err);
    }
  }

  async signupvaliditor(req, res, next) {
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
        return res
          .status(400)
          .json({ error: 400, message: "Invalid LGU Code" });

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
          accountIdPassed = true;
        }
      }

      next();
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async signupCitizen(req, res, next) {
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
        return res
          .status(500)
          .json({ error: 500, message: `Failed to signup.` });
      }
    } catch (err) {
      console.error(err);
      if (err.code == "ER_DUP_ENTRY") {
        let msg = err.message.split("for")[0];
        return res.status(400).json({ error: 400, message: msg.trim() });
      }
      next(err);
    }
  }

  async loginTraceCitizen(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");

    let {
      accountId,
      firstName,
      middleName,
      lastName,
      suffix,
      birthdate,
      sex,
      email,
      mobileNumber,
    } = req.body;
    try {
      let val = JSON.stringify(req.body);

      let check = await req.db.query(
        `
        SELECT 
          accountId,
          firstName,
          middleName,
          lastName,
          suffix,
          birthdate,
          sex,
          familyCode
        FROM citizen_info
        WHERE
          accountId = ?
      `,
        [accountId]
      );

      if (check.length > 0) {
        let citizenData = await getOtherInfo(req, accountId);
        console.log("old", citizenData);
        let results = {
          accountId: check[0].accountId,
        };
        let payload = JSON.parse(JSON.stringify(results));
        let token = jwt.sign(payload, jwtSecret, {
          expiresIn: "365d",
        });
        return res.status(200).json({ data: citizenData, token: token });
      }

      let result = await req.db.query(
        `
        CALL traceIntegration_registration(
          ?, ?, ?, ?, ?, 
          ?, ?, ?, ?, ?,
          ?, ?
        )`,
        [
          accountId,
          firstName,
          middleName,
          lastName,
          suffix,
          birthdate,
          sex,
          email || "no-email@gmail.com",
          mobileNumber,
          date,
          date,
          val,
        ]
      );
      let results = result[0];
      if (results.length > 0) {
        let citizenData = await getOtherInfo(req, accountId);
        console.log("new ", citizenData);
        let reslts = {
          accountId: results[0].accountId,
        };

        let payload = JSON.parse(JSON.stringify(reslts));
        let token = jwt.sign(payload, jwtSecret, {
          expiresIn: "365d",
        });
        return res.status(200).json({ data: citizenData, token: token });
      } else {
        return res
          .status(500)
          .json({ error: 500, message: `Failed to signup.` });
      }
    } catch (err) {
      console.log(err);
      if (err.code == "ER_DUP_ENTRY") {
        let msg = err.message.split("for")[0];
        return res.status(400).json({ error: 400, message: msg.trim() });
      }
      next(err);
    }
  }
  // async generateCode(req, res, next) {
  //   const { email, mobileNumber } = req.body;
  //   let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
  //   try {
  //     let type;
  //     let nval;
  //     if (!global.isEmpty(email)) {
  //       type = "EMAIL";
  //       nval = email;
  //     }
  //     if (!global.isEmpty(mobileNumber)) {
  //       type = "MOBILE";
  //       nval = mobileNumber;
  //     }
  //     let param = [];
  //     param.push(
  //       !global.isEmpty(email)
  //         ? email
  //         : !global.isEmpty(mobileNumber)
  //         ? mobileNumber
  //         : ""
  //     );

  //     let checkDuration = await req.db.query(
  //       `
  //       SELECT
  //         type,
  //         nval,
  //         code,
  //         token,
  //         isExpired
  //       FROM otplogs
  //       WHERE
  //         type = ? AND
  //         nval = ?
  //       ORDER BY id DESC LIMIT 1
  //     `,
  //       [type, nval]
  //     );

  //     let result = await req.db.query(
  //       `
  //     SELECT
  //       accountId,
  //       email,
  //       mobileNumber,
  //       firstName,
  //       isDeleted
  //     FROM
  //       citizen_contacts
  //     WHERE
  //       isDeleted = 0 AND
  //       ${
  //         !global.isEmpty(email)
  //           ? " email = ?"
  //           : !global.isEmpty(mobileNumber)
  //           ? " mobileNumber = ?"
  //           : ""
  //       }
  //     `,
  //       param
  //     );
  //     if (result.length === 0) {
  //       return res.status(401).json({
  //         error: 401,
  //         message: `The email or phone number you provided does not belong to any account.`,
  //       });
  //     }

  //     let code = 111111;
  //     let expIn = "20s";
  //     if (checkDuration.length > 0) {
  //       if (checkDuration[0].isExpired == 1) {
  //         const token = jwt.sign(
  //           {
  //             id: result[0].accountId,
  //             mobile: result[0].mobileNumber,
  //             code: code,
  //           },
  //           jwtSecret,
  //           {
  //             expiresIn: expIn,
  //           }
  //         );
  //         await req.db.query(`INSERT INTO otplogs SET ?`, {
  //           type: type,
  //           nval: nval,
  //           code: code,
  //           token: token,
  //           dateCreated: date,
  //         });
  //         if (!global.isEmpty(email)) {
  //           await sendgrid.emailOtp(email, code);
  //           return res.status(200).json({
  //             token: token,
  //             message: `The OTP has been sent to your email.`,
  //           });
  //         }
  //         if (!global.isEmpty(mobileNumber)) {
  //           // await otp.otpRequest(mobileNumber, code);
  //           return res.status(200).json({
  //             token: token,
  //             code: code,
  //             message: `The OTP has been sent to your mobile number.`,
  //           });
  //         }
  //       } else {
  //         jwt.verify(
  //           checkDuration[0].token,
  //           jwtSecret,
  //           async (err, decoded) => {
  //             if (err) {
  //               const token = jwt.sign(
  //                 {
  //                   id: result[0].accountId,
  //                   mobile: result[0].mobileNumber,
  //                   code: code,
  //                 },
  //                 jwtSecret,
  //                 {
  //                   expiresIn: expIn,
  //                 }
  //               );
  //               await req.db.query(`INSERT INTO otplogs SET ?`, {
  //                 type: type,
  //                 nval: nval,
  //                 code: code,
  //                 token: token,
  //                 dateCreated: date,
  //               });
  //               if (!global.isEmpty(email)) {
  //                 await sendgrid.emailOtp(email, code);
  //                 return res.status(200).json({
  //                   token: token,
  //                   message: `The OTP has been sent to your email.`,
  //                 });
  //               }
  //               if (!global.isEmpty(mobileNumber)) {
  //                 // await otp.otpRequest(mobileNumber, code);
  //                 return res.status(200).json({
  //                   token: token,
  //                   code: code,
  //                   message: `The OTP has been sent to your mobile number.`,
  //                 });
  //               }
  //             } else {
  //               let exp = moment.unix(decoded.exp);
  //               let trackEndTime = exp.format("YYYY-MM-DD HH:mm:ss");
  //               let trackStartTime = moment().format("YYYY-MM-DD HH:mm:ss");
  //               let overallActivity = moment
  //                 .duration(
  //                   moment(trackEndTime, "YYYY-MM-DD HH:mm:ss").diff(
  //                     moment(trackStartTime, "YYYY-MM-DD HH:mm:ss")
  //                   )
  //                 )
  //                 .asSeconds();
  //               return res.status(401).json({
  //                 error: 401,
  //                 duration: overallActivity,
  //                 message: `Sorry, you have to wait for ${overallActivity} second(s) before you can request another OTP.`,
  //               });
  //             }
  //           }
  //         );
  //       }
  //     } else {
  //       const token = jwt.sign(
  //         {
  //           id: result[0].accountId,
  //           mobile: result[0].mobileNumber,
  //           code: code,
  //         },
  //         jwtSecret,
  //         {
  //           expiresIn: expIn,
  //         }
  //       );
  //       await req.db.query(`INSERT INTO otplogs SET ?`, {
  //         type: type,
  //         nval: nval,
  //         code: code,
  //         token: token,
  //         dateCreated: date,
  //       });
  //       if (!global.isEmpty(email)) {
  //         await sendgrid.emailOtp(email, code);
  //         return res.status(200).json({
  //           token: token,
  //           message: `The OTP has been sent to your email.`,
  //         });
  //       }
  //       if (!global.isEmpty(mobileNumber)) {
  //         // await otp.otpRequest(mobileNumber, code);
  //         return res.status(200).json({
  //           token: token,
  //           code: code,
  //           message: `The OTP has been sent to your mobile number.`,
  //         });
  //       }
  //     }
  //   } catch (err) {
  //     console.log(err);
  //     next(err);
  //   }
  // }

  async requestCode(req, res, next) {
    const { mobileNumber } = req.body;
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    try {
      let type;
      let nval;
      if (mobileNumber) {
        type = "MOBILE";
        nval = mobileNumber;
      }

      let checkDuration = await req.db.query(
        `
        SELECT
          type,
          nval,
          code,
          token,
          isExpired
        FROM otplogs
        WHERE
          type = ? AND
          nval = ?
        ORDER BY id DESC LIMIT 1
      `,
        [type, nval]
      );
      let result = await req.db.query(
        `
        SELECT 
          accountId,
          primaryMobile,
          isDeleted 
        FROM 
          citizen_contacts
        WHERE
        primaryMobile LIKE ?
        `,
        [`${mobileNumber}%`]
      );

      let mbl;
      console.log(result);
      if (result.length > 0) {
        mbl = result[0].primaryMobile;
      } else {
        return res.status(401).json({
          error: 401,
          message: `Email not found.`,
        });
      }
      let code = 111111;
      let expIn = "1m";
      if (checkDuration.length > 0) {
        if (checkDuration[0].isExpired == 1) {
          const token = jwt.sign(
            {
              id: result[0].accountId,
              mobile: mbl,
              code: code,
            },
            jwtSecret,
            {
              expiresIn: expIn,
            }
          );
          await req.db.query(`INSERT INTO otplogs SET ?`, {
            type: type,
            nval: nval,
            code: code,
            token: token,
            dateCreated: date,
          });
          // sendgrid.emailOtp(myEmail, code);
          return res.status(200).json({
            token: token,
            message: `The OTP has been sent to your mobilenumber.`,
          });
        } else {
          jwt.verify(
            checkDuration[0].token,
            jwtSecret,
            async (err, decoded) => {
              if (err) {
                const token = jwt.sign(
                  {
                    id: result[0].accountId,
                    mobile: mbl,
                    code: code,
                  },
                  jwtSecret,
                  {
                    expiresIn: expIn,
                  }
                );
                await req.db.query(`INSERT INTO otplogs SET ?`, {
                  type: type,
                  nval: nval,
                  code: code,
                  token: token,
                  dateCreated: date,
                });
                // sendgrid.emailOtp(myEmail, code);
                return res.status(200).json({
                  token: token,
                  message: `The OTP has been sent to your mobilenumber.`,
                });
              } else {
                let exp = moment.unix(decoded.exp);
                let trackEndTime = exp.format("YYYY-MM-DD HH:mm:ss");
                let trackStartTime = moment().format("YYYY-MM-DD HH:mm:ss");
                let overallActivity = moment
                  .duration(
                    moment(trackEndTime, "YYYY-MM-DD HH:mm:ss").diff(
                      moment(trackStartTime, "YYYY-MM-DD HH:mm:ss")
                    )
                  )
                  .asSeconds();

                return res.status(401).json({
                  error: 401,
                  duration: overallActivity,
                  message: `Sorry, you have to wait for ${overallActivity} second(s) before you can request another OTP.`,
                });
              }
            }
          );
        }
      } else {
        const token = jwt.sign(
          {
            id: result[0].accountId,
            mobile: mbl,
            code: code,
          },
          jwtSecret,
          {
            expiresIn: expIn,
          }
        );
        await req.db.query(`INSERT INTO otplogs SET ?`, {
          type: type,
          nval: nval,
          code: code,
          token: token,
          dateCreated: date,
        });
        // sendgrid.emailOtp(myEmail, code);
        return res.status(200).json({
          token: token,
          message: `The OTP has been sent to your mobilenumber.`,
        });
      }
    } catch (err) {
      console.log(err);
      next(err);
    }
  }
  async validateCode(req, res, next) {
    let { token, code } = req.body;
    try {
      jwt.verify(token, jwtSecret, async (err, decoded) => {
        if (err) {
          return res.status(401).json({
            error: 401,
            message:
              "The code you entered already expired. Please request a new one.",
          });
        }
        if (decoded.code != code) {
          return res.status(401).json({
            error: 401,
            message: `The code you entered is incorrect.`,
          });
        }

        if (decoded.code == code) {
          return res.status(200).json({ uId: decoded.id, message: `proceed!` });
        }
      });
    } catch (err) {
      next(err);
    }
  }
  async resetPassword(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { token, uId, password } = req.body;
    try {
      let user = await req.db.query(
        `SELECT 
          accountId
        FROM citizen_info 
        WHERE 
          accountId = ? AND 
          isDeleted = ?`,
        [uId, 0]
      );
      if (user.length === 0) {
        return res.status(401).json({ message: "User does not exist" });
      }

      let npass = await hash.hashPassword(password);
      let result = await req.db.query(
        `UPDATE citizen_credential
          SET 
            password = ?,
            dateUpdated = ? 
          WHERE 
            accountId = ?`,
        [npass, date, user[0].accountId]
      );
      if (result.affectedRows > 0) {
        await req.db.query(
          `
          UPDATE otplogs
          SET
            isExpired = ?
          WHERE 
            token = ?
        `,
          [1, token]
        );
        let auditObj = {
          createdBy: user[0].accountId,
          accountId: user[0].accountId,
          userPriviledge: "HOMEOWNER",
          actionType: "RESET PASSWORD",
          crud: "UPDATE",
          newValue: JSON.stringify(req.body),
          dateCreated: date,
          dateUpdated: date,
        };

        await audit.auditData(req, auditObj);

        return res.status(200).json({
          message: "Your password has been successfully reset.",
        });
      } else {
        return res.status(500).json({
          error: 500,
          message: `Failed to update user password.`,
        });
      }

      // jwt.verify(token, jwtSecret, async (err, decoded) => {
      //   if (err) {
      //     return res
      //       .status(401)
      //       .json({ error: 401, message: "Session already expired." });
      //   }
      // });
    } catch (err) {
      console.log(err);
      next(err);
    }
  }

  async genKey(req, res, next) {
    let { name } = req.body;
    try {
      let npass = await hash.hashPassword(name);
      res.json({ val: npass });
    } catch (err) {
      next(err);
    }
  }
  async addBrgy(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { brgyId, city, name } = req.body;

    try {
      let result = await req.db.query(
        `
        INSERT INTO cvms_brgy SET ?
      `,
        {
          brgyId: brgyId,
          city: city,
          name: name,
          dateCreated: date,
          dateUpdated: date,
        }
      );
      res.status(200).json({ message: "`success" });
    } catch (err) {
      next(err);
    }
  }
  async addAddress(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { cityId, brgyId, street, phase } = req.body;
    try {
      let code = randomize("A0", 5);
      let obj = {
        addressCode: [brgyId, "-", code].join(""),
        brgyId: brgyId,
        street: street,
        phase: phase,
        dateCreated: date,
        dateUpdated: date,
      };
      let result = await req.db.query(
        `
        INSERT INTO cvms_addresses SET ?
      `,
        obj
      );
      console.log(result);
      return res.status(200).json({
        message: `Successfully inserted`,
        response: result,
        body: obj,
      });
    } catch (err) {
      next(err);
    }
  }
  async fetchMunicipalities(req, res, next) {
    try {
      const municipalities = await req.db.query(
        `
        SELECT 
          M.lguCode, 
          M.lguName,
          M.cityCode,
          M.provCode,
          M.regCode,
          CONCAT_WS(' - ',P.provDesc,M.lguName) as lguName
        FROM
          municipalities M
        LEFT JOIN
          province P
          ON P.provCode = M.provCode
      `
      );

      return res.status(200).json(municipalities);
    } catch (err) {
      console.error(err);
      next(err);
    }
  }
}
