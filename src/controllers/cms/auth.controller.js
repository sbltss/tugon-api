import moment from "moment";
import mtz from "moment-timezone";
import jwt, { decode } from "jsonwebtoken";
import uniqid from "uniqid";
import randomize from "randomatic";
import { unescape } from "lodash";
import hash from "#helpers/hash";
import global from "#helpers/global";
import { emailForgotPass } from "../../mailer";

import audit from "#helpers/audit";

let jwtSecret =
  process.env.NODE_ENV === "development"
    ? process.env.jwtSecretKey
    : process.env.jwtSecretKeyProd;
export default class Controller {
  async login(req, res, next) {
    let { email, password } = req.body;
    try {
      const result = await req.db.query(
        `SELECT 
          accountId,
          email,
          accountType,
          isDeleted,
          password
        FROM 
          credentials
        WHERE 
          email  = ?`,
        [email]
      );

      let member = result[0];

      if (!member)
        return res.status(401).json({ message: "Account does not exist" });
      const validPassword = await hash.comparePassword(
        password,
        member.password
      );

      if (!validPassword)
        if (password != member.password)
          return res.status(401).json({ message: "Invalid Credentials" });

      if (member.isDeleted != "0")
        return res.status(401).json({ message: "Account is deactivated" });

      let table;
      if (member.accountType === "superadmin") table = "superadmins";
      if (member.accountType === "brgy") table = "brgy_users";
      if (member.accountType === "department") table = "department_users";

      const result2 = await req.db.query(
        `SELECT A.*, B.brgyDesc
         FROM ${table} A
         LEFT JOIN cvms_brgy B ON B.brgyId = A.brgyId
         WHERE 
         A.accountId = ?`,
        [member.accountId]
      );

      delete result2.password;
      delete result2.isDeleted;
      delete member.password;
      const memberInfo = result2[0];
      if (!memberInfo)
        return res.status(500).json({ message: "Internal Server Error" });

      const lgu = await req.db.query(
        `
        SELECT
          lguCode
        FROM
          municipalities 
        WHERE
          cityCode= ?
      `,
        [memberInfo.cityId]
      );

      if (!lgu[0] && member.accountType !== "superadmin")
        return res.status(500).json({ message: "Internal Server Error" });

      const lguCode = member.accountType !== "superadmin" ? lgu[0].lguCode : "";
      
      let typeDesc = undefined;
      if (member.accountType === "department") {
        const type = await req.db.query(
          `
          SELECT
            type
          FROM
            department_types
          WHERE
            id= ?
        `,
          memberInfo.type
        );

        if (type.length > 0) typeDesc = type[0].type;
      }

      let payload = { accountId: member.accountId };
      let token = jwt.sign(payload, jwtSecret);

      return res.json({
        data: { ...member, ...memberInfo, typeDesc, lguCode },
        token: token,
        isDefaultPass: ["Barangay2023"].includes(password),
      });
    } catch (err) {
      console.error(err);
      next(err);
    }
  }
  async cpmsLogin(req, res, next) {
    let { username, password } = req.body;
    try {
      let result = await req.db.query(
        `
        SELECT
          accountId,
          name,
          module,
          position,
          email,
          username,
          isDeleted,
          password
        FROM cms_accounts
        WHERE
          username = ?
          
      `,
        [username]
      );
      let member = result[0];

      if (!member)
        return res.status(401).json({ message: "Account does not exist" });

      const validPassword = await hash.comparePassword(
        password,
        member.password
      );

      if (!validPassword)
        if (password != member.password)
          return res.status(401).json({ message: "Invalid Credentials" });

      if (member.isDeleted != "0")
        return res.status(401).json({ message: "Account is deactivated" });

      let payload = { accountId: result[0].accountId };
      let token = jwt.sign(payload, jwtSecret, {
        expiresIn: "365d",
      });

      delete result[0].password;

      return res.status(200).json({
        data: result[0],
        token: token,
        defaultPass: password === "Barangay2023",
      });
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async otpResetPass(req, res, next) {
    let { email } = req.body;
    try {
      let checkEmail = await req.db.query(
        `
        SELECT *
        FROM cms_accounts
        WHERE
          email = ?
      `,
        [email]
      );
      if (checkEmail.length === 0) {
        return res
          .status(401)
          .json({ error: 401, message: `Email not found.` });
      }

      let accountId = checkEmail[0].accountId;

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
        ["R-PASS", email]
      );
      let code = 111111;
      let expIn = "1m";
      let otpdata = {
        type: "R-PASS",
        nval: email,
        code: code,
        dateCreated: date,
        isExpired: 0,
      };
      if (checkDuration.length > 0) {
        if (checkDuration[0].isExpired == 1) {
          const token = jwt.sign(
            {
              id: accountId,
              email: email,
              code: code,
            },
            jwtSecret,
            {
              expiresIn: expIn,
            }
          );
          otpdata.token = token;
          await req.db.query(`INSERT INTO otplogs SET ?`, otpdata);
          // sendgrid.emailOtp(email, code);
          return res.status(200).json({
            token: token,
            message: `The OTP has been sent to your email.`,
          });
        } else {
          jwt.verify(
            checkDuration[0].token,
            jwtSecret,
            async (err, decoded) => {
              if (err) {
                const token = jwt.sign(
                  {
                    id: accountId,
                    email: email,
                    code: code,
                  },
                  jwtSecret,
                  {
                    expiresIn: expIn,
                  }
                );
                otpdata.token = token;
                await req.db.query(`INSERT INTO otplogs SET ?`, otpdata);
                // sendgrid.emailOtp(email, code);
                return res.status(200).json({
                  token: token,
                  message: `The OTP has been sent to your email.`,
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
            id: accountId,
            email: email,
            code: code,
          },
          jwtSecret,
          {
            expiresIn: expIn,
          }
        );
        otpdata.token = token;
        await req.db.query(`INSERT INTO otplogs SET ?`, otpdata);
        // sendgrid.emailOtp(email, code);
        return res.status(200).json({
          token: token,
          message: `The OTP has been sent to your email.`,
        });
      }
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async resetPass(req, res, next) {
    let { email, token } = req.body;
    const date = moment().tz("Asia/Manila").format("YYYY-MM-DD HH:mm:ss");
    try {
      jwt.verify(reqToken, jwtSecret, async (err, decoded) => {
        if (err) {
          return res.status(401).json({
            error: 401,
            message: `Sorry, Your email verification request already expired.`,
          });
        } else {
          if (!Object.keys(decoded).includes("email")) {
            return res
              .status(401)
              .json({ error: 401, message: `Invalid token.` });
          }
          let { accountId } = decoded;
          let user = await req.db.query(
            `
            SELECT * 
            FROM cms_accounts
            WHERE
              accountId = ?
          `,
            [accountId]
          );
          let result = await req.db.query(
            `
            UPDATE cms_accounts
            SET ?
            WHERE accountId = ?
          `,
            [
              {
                isDefault: 1,
                password: "dgsUser2022@!",
                dateUpdated: date,
              },
              accountId,
            ]
          );
          if (result.affectedRows > 0) {
            // sendgrid.emailOtp(email, code);
            let auditObj = {
              createdBy: accountId,
              accountId: accountId,
              userPriviledge: `${user[0].module} ${user[0].position}`,
              actionType: "RESET PASSWORD",
              crud: "UPDATE",
              oldValue: JSON.stringify(req.currentUser.contacts),
              newValue: JSON.stringify({
                isDefault: 0,
                password: "dgsUser2022@!",
                dateUpdated: date,
              }),
              dateCreated: date,
              dateUpdated: date,
            };

            await audit.auditData(req, auditObj);
            return res.status(200).json({
              message: "Email sent.",
            });
          } else {
            return res.status(500).json({
              error: 500,
              message: `Failed to update your email.`,
            });
          }
        }
      });
    } catch (err) {
      console.error(err);
      next(err);
    }
  }
  async brgyLogin(req, res, next) {
    //carlo
    let { username, password } = req.body;
    try {
      let result = await req.db.query(
        `
        SELECT
          A.password,
          A.brgyUid,
          A.firstName,
          A.middleName,
          A.lastName,
          A.birthdate,
          A.mobileNumber,
          A.module,
          A.accountType,
          A.section,
          A.email,
          A.username,
          A.isDeleted,
          B.brgyId,
          B.brgyDesc,
          B.cityId,
          B.cityDesc,
          B.provinceId,
          B.provinceDesc,
          B.regionId,
          B.regionDesc
        FROM brgy_accounts A
        LEFT JOIN cvms_brgy B
          USING(brgyId)
        WHERE
          username = ?
          
      `,
        [username]
      );
      let member = result[0];

      if (!member)
        return res.status(401).json({ message: "Account does not exist" });

      const validPassword = await hash.comparePassword(
        password,
        member.password
      );

      if (!validPassword)
        if (password != member.password)
          return res.status(401).json({ message: "Invalid Credentials" });

      if (member.isDeleted != "0")
        return res.status(401).json({ message: "Account is deactivated" });

      let payload = { brgyUid: result[0].brgyUid };
      let token = jwt.sign(payload, jwtSecret, {
        expiresIn: "365d",
      });

      delete result[0].password;

      return res.status(200).json({
        data: result[0],
        token: token,
        defaultPass: password === "Barangay2023",
      });
    } catch (err) {
      console.error(err);
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

  async changePasswordWithToken(req, res, next) {
    const date = moment().tz("Asia/Manila").format("YYYY-MM-DD HH:mm:ss");
    const { accountId } = req.currentUser;
    const { password } = req.body;
    try {
      const hashedPassword = await hash.hashPassword(password);
      const update = await req.db.query(
        `
          UPDATE
            credentials
          SET 
            ?
          WHERE
            accountId= ?
        `,
        [{ password: hashedPassword, dateUpdated: date }, accountId]
      );
      if (update.affectedRows === 0)
        throw new Error("Failed to update password");
      return res.status(200).json({ message: "Password updated successfully" });
    } catch (err) {
      console.error(err);
      next(err);
    }
  }
  async sendOtp(req, res, next) {
    const date = moment().tz("Asia/Manila").format("YYYY-MM-DD HH:mm:ss");
    const { email } = req.body;
    // const code = 111111;
    const code = randomize("0", 6);
    try {
      const result = await req.db.query(
        `SELECT 
          accountId,
          email,
          accountType,
          isDeleted
        FROM 
          credentials
        WHERE 
          email  = ?`,
        [email]
      );

      let member = result[0];

      if (!member)
        return res.status(401).json({ message: "Account does not exist" });
      if (member.isDeleted != "0")
        return res.status(401).json({ message: "Account is deactivated" });

      const checkExistingResult = await req.db.query(
        `
          SELECT
            token
          FROM 
            otplogs
          WHERE
            nval =? AND
            isExpired = 0 AND
            userType= "cms"
          ORDER BY 
            dateCreated DESC 
          LIMIT 
            1
        `,
        email
      );
      const existing = checkExistingResult[0];

      let isExpired = true;

      if (existing) {
        jwt.verify(existing.token, jwtSecret, async (err, decoded) => {
          if (!err) {
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

            isExpired = false;
            return res.status(401).json({
              error: 401,
              duration: overallActivity,
              message: `Sorry, you have to wait for ${overallActivity} second(s) before you can request another OTP.`,
            });
          }
          isExpired = true;
        });
      }
      if (!isExpired) return;

      const otpToken = jwt.sign({ email, code }, jwtSecret, {
        expiresIn: 60 * 5,
      });

      const body = {
        type: "EMAIL",
        nval: email,
        code: code,
        token: otpToken,
        userType: "cms",
        dateCreated: date,
        isExpired: 0,
      };

      const insert = await req.db.query(
        `
        INSERT INTO
          otplogs
        SET ?
      `,
        body
      );

      if (!insert.insertId)
        return res.status(500).json({ message: "Internal Server Error" });

      await emailForgotPass(email, code);
      return res
        .status(200)
        .json({ message: "Email OTP sent", token: otpToken });
    } catch (err) {
      next(err);
    }
  }
  async submitOtp(req, res, next) {
    const { otp, token } = req.body;
    try {
      jwt.verify(token, jwtSecret, async (err, decoded) => {
        if (!err) {
          if (decoded.code != otp) {
            return res.status(401).json({ message: "Invalid OTP" });
          }
          return res.status(200).json({
            email: decoded.email,
            message: "Valid OTP, please proceed",
          });
        }
        return res.status(401).json({
          message: "The code you entered already expired, request a new one.",
        });
      });
    } catch (err) {
      next(err);
    }
  }
  async changePassword(req, res, next) {
    const { password, email } = req.body;
    try {
      const hashedPassword = await hash.hashPassword(password);
      const update = await req.db.query(
        `
              UPDATE
                credentials
              SET 
                password =?
              WHERE
                email =?
            `,
        [hashedPassword, email]
      );
      if (update.affectedRows > 0) {
        await req.db.query(
          `
                UPDATE
                  otplogs
                SET 
                  isExpired = 1
                WHERE
                  nval =?
              `,
          email
        );
        return res
          .status(200)
          .json({ message: "Password updated successfully" });
      } else {
        return res.status(500).json({ message: "Internal Server Error" });
      }
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async changePasswordAthenticated(req, res, next) {
    const date = moment().tz("Asia/Manila").format("YYYY-MM-DD HH:mm:ss");
    const { accountId } = req.currentUser;
    const { currentPassword, newPassword } = req.body;
    try {
      const userCred = await req.db.query(
        `
          SELECT 
            password
          FROM 
            credentials
          WHERE 
              accountId = ?
        `,
        accountId
      );
      console.log(currentPassword, newPassword);

      if (
        !(await hash.comparePassword(currentPassword, userCred[0].password))
      ) {
        return res.status(400).json({
          error: 400,
          message: "Invalid credentials. Please try again.",
        });
      }

      const hashedPassword = await hash.hashPassword(newPassword);

      const updateUser = await req.db.query(
        `
        UPDATE
          credentials
        SET ?
        WHERE
          accountId = ?
      `,
        [{ password: hashedPassword, dateUpdated: date }, accountId]
      );

      if (updateUser.affectedRows === 0)
        throw new Error("Failed to update password");

      return res
        .status(200)
        .json({ message: "Password updated successfully." });
    } catch (err) {
      console.error(err);
      next(err);
    }
  }
}
