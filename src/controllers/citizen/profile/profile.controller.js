import moment from "moment";
import mtz from "moment-timezone";
import fs from "fs";
import OTP from "#helpers/otp";
import jwt from "jsonwebtoken";
import randomize from "randomatic";
import hash from "#helpers/hash";
import SendGrid from "#helpers/sendgrid";
import global from "#helpers/global";

import audit from "#helpers/audit";
import unlinkFiles from "#helpers/unlinkfiles";
import { result, isEmpty } from "lodash";

let sendgrid = new SendGrid();
let jwtSecret =
  process.env.NODE_ENV === "development"
    ? process.env.jwtSecretKey
    : process.env.jwtSecretKeyProd;

let validateCitizenName = async (req) => {
  let { accountId } = req.currentUser;
  try {
    let { firstName, middleName, lastName, suffix, birthdate } = req.body;

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
          birthdate = ? AND
          accountId != ?
      `,
      [
        `${firstName}%`,
        !global.isEmpty(middleName) ? `${middleName}%` : "%",
        `${lastName}%`,
        !global.isEmpty(suffix) ? `${suffix}%` : "%",
        birthdate,
        accountId,
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
        return {
          error: 403,
          message: `It seems that you've already registered..`,
        };
      }
    }
    return {
      error: 200,
      message: `proceed.`,
    };
  } catch (err) {
    console.log("validate name", err);
    return {
      error: 500,
      message: `An error occurred.`,
    };
  }
};
let validateCitizenEmail = async (req) => {
  let { accountId } = req.currentUser;
  try {
    let { email } = req.body;

    let checkEmail = await req.db.query(
      `
        SELECT
          primaryEmail
        FROM
        citizen_contacts
        WHERE
          primaryEmail LIKE ? AND
          accountId != ?
      `,
      [`${email}%`, accountId]
    );
    if (checkEmail.length > 0) {
      return {
        error: 400,
        message: `Email already exists.`,
      };
    }
    return {
      error: 200,
      message: `proceed.`,
    };
  } catch (err) {
    return {
      error: 500,
      message: `An error occurred.`,
    };
  }
};

export default class Controller {
  // async getProfileAccountId(req, res, next) {
  //   let { accountId } = req.currentUser;
  //   try {
  //     let info = await req.db.query(
  //       `
  // 			SELECT
  //         accountId,
  //         firstName,
  //         middleName,
  //         lastName,
  //         suffix,
  //         birthdate,
  //         sex
  // 			FROM citizen_info
  // 			WHERE
  // 				accountId = ?
  // 		`,
  //       [accountId]
  //     );
  //     let contacts = await req.db.query(
  //       `
  //       SELECT
  //         primaryEmail,
  //         primaryMobile
  //       FROM citizen_contacts
  //       WHERE
  //         accountId = ?
  //     `,
  //       [accountId]
  //     );
  //     // let contacts = await req.db.query(
  //     //   `
  //     //   SELECT
  //     //     primaryEmail,
  //     //     isEmailVerified,
  //     //     primaryMobile,
  //     //     isMobileVerified
  //     //   FROM citizen_contacts
  //     //   WHERE
  //     //     accountId = ?
  //     // `,
  //     //   [accountId]
  //     // );

  //     // let citizenFiles = await req.db.query(
  //     //   `
  //     //   SELECT
  //     //     imageId,
  //     //     image,
  //     //     module,
  //     //     type
  //     //   FROM citizen_files
  //     //   WHERE
  //     //     accountId = ? AND
  //     //     isDeleted = ?
  //     // `,
  //     //   [accountId, 0]
  //     // );

  //     info[0].contacts = contacts[0];

  //     if (info.length > 0) {
  //       return res.status(200).json(info[0]);
  //     } else {
  //       return res
  //         .status(401)
  //         .json({ error: 401, message: `Failed to fetch data.` });
  //     }
  //   } catch (err) {
  //     next(err);
  //   }
  // }
  async getProfile(req, res, next) {
    let { accountId } = req.currentUser;
    try {
      let info = await req.db.query(
        `
				SELECT 
          accountId,
          CONCAT(
          COALESCE(firstName, ''),
          ' ',
          COALESCE(middleName, ''),
          ' ',
          COALESCE(lastName, ''),
          ' ',
          COALESCE(suffix, '')
          ) AS fullName,          
          firstName,
          middleName,
          lastName,
          suffix,
          birthdate,
          sex
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
          primaryMobile
        FROM citizen_contacts
        WHERE
          accountId = ?
      `,
        [accountId]
      );

      let citizenso = await req.db.query(
        `
        SELECT
          brgyId,
          cityId,
          provinceId,
          regionId
        FROM registration_logs
        WHERE
          accountId = ? 
      `,
        [accountId]
      );

      let citizenFiles = await req.db.query(
        `
        SELECT 
          imageId,
          image,
          module,
          type
        FROM citizen_files
        WHERE
          accountId = ? AND
          isDeleted = ?
      `,
        [accountId, 0]
      );

      // let contacts = await req.db.query(
      //   `
      //   SELECT
      //     primaryEmail,
      //     isEmailVerified,
      //     primaryMobile,
      //     isMobileVerified
      //   FROM citizen_contacts
      //   WHERE
      //     accountId = ?
      // `,
      //   [accountId]
      // );

      // let citizenFiles = await req.db.query(
      //   `
      //   SELECT
      //     imageId,
      //     image,
      //     module,
      //     type
      //   FROM citizen_files
      //   WHERE
      //     accountId = ? AND
      //     isDeleted = ?
      // `,
      //   [accountId, 0]
      // );

      info[0].files = citizenFiles;
      // info[0].address = citizenso[0];

      if (
        info.length === 0 ||
        contacts.length === 0 ||
        citizenso.length === 0
      ) {
        return res.status(404).json({
          error: 404,
          message: "No data found for the provided accountId.",
        });
      }

      let result = {
        ...info[0],
        ...contacts[0],
        ...citizenso[0],
      };

      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
  async validateProfileStatus(req, res, next) {
    let { accountId } = req.currentUser;
    try {
      let result = await req.db.query(
        `
        SELECT
          status,
          services
        FROM citizen_verifystatus
        WHERE
          accountId = ? AND
          services = ? 
        ORDER BY id DESC 
      `,
        [accountId, "PROFILE"]
      );
      if (result[0].status === "PENDING") {
        let validateName = await validateCitizenName(req);

        if (validateName.error === 200) {
          let { ...rest } = req.body;
          req.body.newBody = { ...rest };
          next();
        } else {
          return res.status(validateName.error).json(validateName);
        }
      } else {
        let { firstName, middleName, lastName, suffix, birthdate, ...rest } =
          req.body;
        req.body.newBody = { ...rest };
        next();
      }
    } catch (err) {
      console.log(err);
      next(err);
    }
  }
  async updateProfile(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { accountId } = req.currentUser;
    let val = req.body;
    let transaction;

    val.dateUpdated = date;
    let { primaryEmail, primaryMobile, ...newVal } = val;

    try {
      let validate = await req.db.query(
        `
        SELECT *
        FROM citizen_info
        WHERE
          accountId = ?
      `,
        accountId
      );

      if (validate.length === 0) {
        res.status(404).json({ message: "Account not found" });
      }

      transaction = await req.db.getConnection();

      await transaction.beginTransaction();

      let [updateInfo] = await transaction.query(
        `
           	UPDATE citizen_info
          	SET ?
           	WHERE
             accountId = ?
          `,
        [newVal, accountId]
      );

      if (updateInfo.affectedRows === 0) {
        throw {
          error: 500,
          // loc: "update profile_document",
          message: "An error occurred. Please try again",
        };
      }

      let [updateContact] = await transaction.query(
        `
           	UPDATE citizen_contacts
          	SET ?
           	WHERE
             accountId = ?
          `,
        [{ primaryEmail, primaryMobile }, accountId]
      );

      if (updateContact.affectedRows === 0) {
        throw {
          error: 400,
          // loc: "update profile_document",
          message: "An error occurred. Please try again",
        };
      }

      await transaction.commit();
      await transaction.release();
      res.status(200).json({ message: "Updated Successfully" });
    } catch (err) {
      await transaction.rollback();
      await transaction.release();
      next(err);
    }
  }
  async uploadSupportingFiles(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { accountId } = req.currentUser;
    let files = req.files;
    let transaction;
    try {
      if (Object.keys(files).length === 0) {
        return res.status(400).json({
          error: 400,
          message: "No files were uploaded",
        });
      }

      transaction = await req.db.getConnection();

      await transaction.beginTransaction();

      if (!global.isEmpty(files.identification)) {
        let idn = files.identification[0].path;
        let [checkId] = await transaction.query(
          `
          SELECT imageId
          FROM citizen_files
          WHERE 
            accountId = ? AND
            module = ? AND
            type = ? AND 
            isDeleted = ?
        `,
          [accountId, "PROFILE", "PROFILE_ID", 0]
        );
        console.log("check id", checkId.length);
        if (checkId.length > 0) {
          let [update] = await transaction.query(
            `
            UPDATE citizen_files
            SET ? 
            WHERE 
              imageId = ? 
          `,
            [
              {
                image: idn,
                dateUpdated: date,
              },
              checkId[0].imageId,
            ]
          );
          if (!update.affectedRows) {
            throw {
              error: 500,
              loc: "update profile_id",
              message: "An error occurred. Please try again",
            };
          }
        } else {
          let [genUUID] = await transaction.query(`
            SELECT UUID() AS uuid
          `);
          const { uuid } = genUUID[0];
          console.log("insert id", {
            accountId: accountId,
            imageId: uuid,
            image: idn,
            module: "PROFILE",
            type: "PROFILE_ID",
            status: "PENDING",
            dateCreated: date,
            dateUpdated: date,
          });
          let [insert] = await transaction.query(
            `
            INSERT INTO citizen_files
            SET ?  
          `,
            [
              {
                accountId: accountId,
                imageId: uuid,
                image: idn,
                module: "PROFILE",
                type: "PROFILE_ID",
                dateCreated: date,
                dateUpdated: date,
              },
            ]
          );
          if (!insert.insertId) {
            throw {
              error: 500,
              loc: "add profile_id",
              message: "An error occurred. Please try again",
            };
          }
        }
      }
      if (!global.isEmpty(files.document)) {
        let docu = files.document[0].path;
        let [checkId] = await transaction.query(
          `
          SELECT imageId 
          FROM citizen_files
          WHERE 
            accountId = ? AND
            module = ? AND
            type = ? AND 
            isDeleted = ?
        `,
          [accountId, "PROFILE", "PROFILE_DOCUMENT", 0]
        );
        if (checkId.length > 0) {
          let [update] = await transaction.query(
            `
            UPDATE citizen_files
            SET ? 
            WHERE 
              imageId = ? 
          `,
            [
              {
                image: docu,
                dateUpdated: date,
              },
              checkId[0].imageId,
            ]
          );
          if (!update.affectedRows) {
            throw {
              error: 500,
              loc: "update profile_document",
              message: "An error occurred. Please try again",
            };
          }
        } else {
          let [genUUID] = await transaction.query(`
            SELECT UUID() AS uuid
          `);
          const { uuid } = genUUID[0];
          let [insert] = await transaction.query(
            `
            INSERT INTO citizen_files
            SET ?  
          `,
            [
              {
                accountId: accountId,
                imageId: uuid,
                image: docu,
                module: "PROFILE",
                type: "PROFILE_DOCUMENT",
                dateCreated: date,
                dateUpdated: date,
              },
            ]
          );
          if (!insert.insertId) {
            throw {
              error: 500,
              loc: "add profile_document",
              message: "An error occurred. Please try again",
            };
          }
        }
      }

      if (!global.isEmpty(files.profile)) {
        let proPic = files.profile[0].path;
        let [checkId] = await transaction.query(
          `
          SELECT imageId 
          FROM citizen_files
          WHERE 
            accountId = ? AND
            module = ? AND
            type = ? AND 
            isDeleted = ?
        `,
          [accountId, "PROFILE", "PROFILE_PICTURE", 0]
        );
        if (checkId.length > 0) {
          let [update] = await transaction.query(
            `
            UPDATE citizen_files
            SET ? 
            WHERE 
              imageId = ? 
          `,
            [
              {
                image: proPic,
                dateUpdated: date,
              },
              checkId[0].imageId,
            ]
          );
          if (!update.affectedRows) {
            throw {
              error: 500,
              loc: "update profile_picture",
              message: "An error occurred. Please try again",
            };
          }
        } else {
          let [genUUID] = await transaction.query(`
            SELECT UUID() AS uuid
          `);
          const { uuid } = genUUID[0];
          let [insert] = await transaction.query(
            `
            INSERT INTO citizen_files
            SET ?  
          `,
            [
              {
                accountId: accountId,
                imageId: uuid,
                image: proPic,
                module: "PROFILE",
                type: "PROFILE_PICTURE",
                dateCreated: date,
                dateUpdated: date,
              },
            ]
          );
          if (!insert.insertId) {
            throw {
              error: 500,
              loc: "add profile_picture",
              message: "An error occurred. Please try again",
            };
          }
        }
      }

      await transaction.commit();
      await transaction.release();
      res.status(200).json({ message: "Files uploaded successfully" });
    } catch (err) {
      unlinkFiles.unlinkProfileFiles(req.files);
      await transaction.rollback();
      await transaction.release();
      console.log(err);
      next(err);
    }
  }

  async reqVerifyEmail(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { accountId, contacts } = req.currentUser;
    let { primaryEmail, isEmailVerified } = contacts;
    try {
      if (isEmailVerified == 1) {
        return res
          .status(401)
          .json({ error: 401, message: `Email already verified` });
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
        ["V-EMAIL", primaryEmail]
      );

      let code = 111111;
      let expIn = "1m";
      let otpdata = {
        type: "V-EMAIL",
        nval: primaryEmail,
        code: code,
        dateCreated: date,
        isExpired: 0,
      };
      if (checkDuration.length > 0) {
        if (checkDuration[0].isExpired == 1) {
          const token = jwt.sign(
            {
              id: accountId,
              email: primaryEmail,
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
                    email: primaryEmail,
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
            email: primaryEmail,
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
      next(err);
    }
  }
  async verifyEmail(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { accountId, contacts } = req.currentUser;
    let { primaryEmail } = contacts;
    let { token: reqToken } = req.body;

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
          let result = await req.db.query(
            `
            UPDATE citizen_contacts
            SET ?
            WHERE accountId = ?
          `,
            [
              {
                isEmailVerified: 1,
                dateUpdated: date,
              },
              accountId,
            ]
          );
          if (result.affectedRows > 0) {
            let auditObj = {
              createdBy: accountId,
              accountId: accountId,
              userPriviledge: "CITIZEN",
              actionType: "VERIFY EMAIL",
              crud: "UPDATE",
              oldValue: JSON.stringify(req.currentUser.contacts),
              newValue: JSON.stringify({
                email: primaryEmail,
                isEmailVerified: 1,
                dateUpdated: date,
              }),
              dateCreated: date,
              dateUpdated: date,
            };

            await audit.auditData(req, auditObj);
            return res.status(200).json({
              message: "Update successfully.",
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
      next(err);
    }
  }

  async reqVerifyMobile(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { accountId, contacts } = req.currentUser;
    let { primaryMobile, isMobileVerified } = contacts;
    try {
      if (isMobileVerified == 1) {
        return res
          .status(401)
          .json({ error: 401, message: `Email already verified` });
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
        ["V-MOBILE", primaryMobile]
      );
      let code = 111111;
      let expIn = "1m";
      let otpdata = {
        type: "V-MOBILE",
        nval: primaryMobile,
        code: code,
        dateCreated: date,
        isExpired: 0,
      };
      if (checkDuration.length > 0) {
        if (checkDuration[0].isExpired == 1) {
          const token = jwt.sign(
            {
              id: accountId,
              mobile: primaryMobile,
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
                    id: accountId,
                    mobile: primaryMobile,
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
            id: accountId,
            mobile: primaryMobile,
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
          message: `The OTP has been sent to your mobilenumber.`,
        });
      }
    } catch (err) {
      next(err);
    }
  }
  async verifyMobile(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { accountId, contacts } = req.currentUser;
    let { primaryMobile } = contacts;
    let { token: reqToken } = req.body;
    try {
      jwt.verify(reqToken, jwtSecret, async (err, decoded) => {
        if (err) {
          return res.status(401).json({
            error: 401,
            message: `Sorry, Your mobile verification request already expired.`,
          });
        } else {
          if (!Object.keys(decoded).includes("mobile")) {
            return res
              .status(401)
              .json({ error: 401, message: `Invalid token.` });
          }
          let result = await req.db.query(
            `
            UPDATE citizen_contacts
            SET ?
            WHERE accountId = ?
          `,
            [
              {
                isMobileVerified: 1,
                dateUpdated: date,
              },
              accountId,
            ]
          );
          if (result.affectedRows > 0) {
            let auditObj = {
              createdBy: accountId,
              accountId: accountId,
              userPriviledge: "CITIZEN",
              actionType: "VERIFY MOBILE",
              crud: "UPDATE",
              oldValue: JSON.stringify(req.currentUser.contacts),
              newValue: JSON.stringify({
                mobile: primaryMobile,
                isMobileVerified: 1,
                dateUpdated: date,
              }),
              dateCreated: date,
              dateUpdated: date,
            };

            await audit.auditData(req, auditObj);
            return res.status(200).json({
              message: "Update successfully.",
            });
          } else {
            return res.status(500).json({
              error: 500,
              message: `Failed to update your mobilenumber.`,
            });
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async reqChangeEmail(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { accountId } = req.currentUser;
    let { email, password } = req.body;

    try {
      let check = await req.db.query(
        `
        SELECT primaryEmail
        FROM citizen_contacts 
        WHERE
          primaryEmail = ? AND
          accountId != ?
      `,
        [email, accountId]
      );
      if (check.length > 0) {
        return res.status(409).json({
          error: 409,
          message: "The email you tried to enter already used.",
        });
      }

      let checkCredential = await req.db.query(
        `
        SELECT
          accountId,
          password
        FROM citizen_credential
        WHERE
          accountId = ? 
      `,
        [accountId]
      );
      if (
        !(await hash.comparePassword(password, checkCredential[0].password))
      ) {
        return res.status(400).json({
          error: 400,
          message: "Invalid credentials. Please try again.",
        });
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
        ["C-EMAIL", email]
      );

      // let code = randomize("0", 6);
      let code = 111111;
      let expIn = "1m";
      let otpdata = {
        type: "C-EMAIL",
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
          if (!isEmpty(email)) {
            // sendgrid.emailOtp(email, code);
            return res.status(200).json({
              token: token,
              message: `The OTP has been sent to your email.`,
            });
          }
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
        if (!global.isEmpty(email)) {
          // sendgrid.emailOtp(email, code);
          return res.status(200).json({
            token: token,
            message: `The OTP has been sent to your email.`,
          });
        }
      }
    } catch (err) {
      console.log(err);
      next(err);
    }
  }
  async updateEmail(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { accountId } = req.currentUser;
    let { email, code } = req.body;
    try {
      let check = await req.db.query(
        `
        SELECT *
        FROM otplogs
        WHERE
          type = ? AND
          nval = ?
        ORDER BY id DESC LIMIT 1
      `,
        ["C-EMAIL", email]
      );
      if (check[0].code !== code) {
        return res
          .status(401)
          .json({ error: 401, message: `Code mismatched.` });
      }

      let result = await req.db.query(
        `
        UPDATE citizen_contacts
        SET ?
        WHERE accountId = ?
      `,
        [
          {
            primaryEmail: email,
            isEmailVerified: 1,
            dateUpdated: date,
          },
          accountId,
        ]
      );
      if (result.affectedRows > 0) {
        let auditObj = {
          createdBy: accountId,
          accountId: accountId,
          userPriviledge: "CITIZEN",
          actionType: "UPDATE CHANGE EMAIL",
          crud: "UPDATE",
          oldValue: JSON.stringify(req.currentUser.contacts),
          newValue: JSON.stringify({
            email: email,
            isEmailVerified: 1,
            dateUpdated: date,
          }),
          dateCreated: date,
          dateUpdated: date,
        };

        await audit.auditData(req, auditObj);
        return res.status(200).json({
          message: "Update failed successfully.",
        });
      } else {
        return res.status(500).json({
          error: 500,
          message: `Failed to update your email.`,
        });
      }
    } catch (err) {
      next(err);
    }
  }

  async changeMobileRequest(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { accountId } = req.currentUser;
    let { mobileNumber, password } = req.body;

    try {
      let check = await req.db.query(
        `
        SELECT primaryMobile
        FROM citizen_contacts 
        WHERE
          primaryMobile = ? AND
          accountId != ?
      `,
        [mobileNumber, accountId]
      );
      if (check.length > 0) {
        return res.status(409).json({
          error: 409,
          message: "The mobile number you tried to enter is already used.",
        });
      }

      let checkCredential = await req.db.query(
        `
        SELECT
          accountId,
          password
        FROM citizen_credential
        WHERE
          accountId = ? 
      `,
        [accountId]
      );
      if (
        !(await hash.comparePassword(password, checkCredential[0].password))
      ) {
        return res.status(400).json({
          error: 400,
          message: "Invalid credentials. Please try again.",
        });
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
        ["C-MOBILE", mobileNumber]
      );

      // let code = randomize("0", 6);
      let code = 111111;
      let expIn = "1m";
      let otpdata = {
        type: "C-MOBILE",
        nval: mobileNumber,
        code: code,
        dateCreated: date,
        isExpired: 0,
      };

      if (checkDuration.length > 0) {
        if (checkDuration[0].isExpired == 1) {
          const token = jwt.sign(
            {
              id: accountId,
              mobile: mobileNumber,
              code: code,
            },
            jwtSecret,
            {
              expiresIn: expIn,
            }
          );
          otpdata.token = token;
          await req.db.query(`INSERT INTO otplogs SET ?`, otpdata);
          return res.status(200).json({
            token: token,
            message: `The OTP has been sent to your mobile number.`,
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
                    mobile: mobileNumber,
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
                  message: `The OTP has been sent to your mobile number.`,
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
            mobile: mobileNumber,
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
          message: `The OTP has been sent to your mobile number.`,
        });
      }
    } catch (err) {
      next(err);
    }
  }
  async updateMobile(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { accountId } = req.currentUser;
    let { mobileNumber, code } = req.body;
    try {
      let check = await req.db.query(
        `
        SELECT *
        FROM otplogs
        WHERE
          type = ? AND
          nval = ?
        ORDER BY id DESC LIMIT 1
      `,
        ["C-MOBILE", mobileNumber]
      );
      if (check[0].code !== code) {
        return res
          .status(401)
          .json({ error: 401, message: `Code mismatched.` });
      }
      let result = await req.db.query(
        `
        UPDATE citizen_contacts
        SET ?
        WHERE accountId = ?
      `,
        [
          {
            primaryMobile: mobileNumber,
            isMobileVerified: 1,
            dateUpdated: date,
          },
          accountId,
        ]
      );
      if (result.affectedRows > 0) {
        let auditObj = {
          createdBy: accountId,
          accountId: accountId,
          userPriviledge: "CITIZEN",
          actionType: "UPDATE CHANGE MOBILE",
          crud: "UPDATE",
          oldValue: JSON.stringify(req.currentUser.contacts),
          newValue: JSON.stringify({
            primaryMobile: mobileNumber,
            isMobileVerified: 1,
            dateUpdated: date,
          }),
          dateCreated: date,
          dateUpdated: date,
        };

        await audit.auditData(req, auditObj);
        return res.status(200).json({
          message: "Update successfully.",
        });
      } else {
        return res.status(500).json({
          error: 500,
          message: `Failed to update your mobile number.`,
        });
      }
    } catch (err) {
      next(err);
    }
  }

  async updatePassword(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { accountId } = req.currentUser;
    let { oldPassword, password } = req.body;
    try {
      let check = await req.db.query(
        `
        SELECT password
        FROM citizen_credential
        WHERE
          accountId = ?
      `,
        [accountId]
      );

      if (!(await hash.comparePassword(oldPassword, check[0].password))) {
        return res.status(401).json({
          status: 401,
          message: "Invalid password. Please try again.",
        });
      }
      let npass = await hash.hashPassword(password);
      console.log("first");
      let result = await req.db.query(
        `
        UPDATE citizen_credential
        SET ?
        WHERE
          accountId = ?
      `,
        [
          {
            password: npass,
            dateUpdated: date,
          },
          accountId,
        ]
      );

      if (result.affectedRows > 0) {
        let auditObj = {
          createdBy: accountId,
          accountId: accountId,
          userPriviledge: "CITIZEN",
          actionType: "UPDATE PASSWORD",
          crud: "UPDATE",
          oldValue: null,
          newValue: JSON.stringify({
            oldPass: oldPassword,
            password: password + npass,
            dateUpdated: date,
          }),
          dateCreated: date,
          dateUpdated: date,
        };

        await audit.auditData(req, auditObj);
        return res.status(200).json({ message: `Updated successfully.` });
      } else {
        return res
          .status(400)
          .json({ status: 400, message: `Failed to update password.` });
      }
    } catch (err) {
      next(err);
    }
  }

  async updateAddress(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { accountId, cvmsInfo } = req.currentUser;
    let { isHead, addressCode, familyHeadId, familyRelation } = req.body;
    let householdId;
    try {
      if (isEmpty(cvmsInfo)) {
        return res
          .status(401)
          .json({ error: 401, message: `Failed, No assigned address found.` });
      } else {
        householdId = cvmsInfo.householdId;
      }
      let ProfileStatus = await req.db.query(
        `
      SELECT *
      FROM citizen_verifystatus
      WHERE 
        accountId = ? AND
        services = ? AND
        isDeleted = ? AND 
        status = ?
    `,
        [accountId, "PROFILE", 0, "PENDING"]
      );

      if (ProfileStatus.length > 0) {
        return res
          .status(401)
          .json({ error: 401, message: `Citizen is not yet verified.` });
      }
      let isExists = await req.db.query(
        `
      SELECT * 
      FROM cvms_familymembers
      WHERE
      accountId = ? AND
      status = ?
    `,
        [accountId, 1]
      );

      if (isExists.length > 0) {
        return res.status(401).json({ error: 401, message: `Already exists.` });
      }
      let sql;
      let param;
      if (isHead == 0 && global.isEmpty(familyHeadId)) {
        return res.status(401).json({
          error: 401,
          message: `Maari po lamang na piliin ang inyong haligi ng tahanan upang kayo ay mapabilang sa kanyang pamilya.`,
        });
      } else if (isHead == 0 && !global.isEmpty(familyHeadId)) {
        sql = `
        SELECT * 
        FROM cvms_familymembers
        WHERE
        addressCode = ? AND
        SUBSTR(familyType,3,3) = ? AND
        accountId = ?
        ORDER BY familyType DESC LIMIT 1
      `;
        param = [addressCode, "A", familyHeadId];
      } else {
        sql = `
        SELECT * 
        FROM cvms_familymembers
        WHERE
        addressCode = ? AND
        SUBSTR(familyType,3,3) = ?
        ORDER BY familyType DESC LIMIT 1
      `;
        param = [addressCode, "A"];
      }
      let checkFamily = await req.db.query(sql, param);
      if (isHead == 0 && checkFamily.length == 0) {
        return res.status(401).json({
          error: 401,
          message: `Maari po lamang na magparehistro muna ang inyong haligi ng tahanan bago ang mga myembro neto.`,
        });
      }

      let result = await req.db.query(
        `
      CALL household_changeAddress(
        ?, ?, ?, ?, ?,  
        ?, ?, ?, ?
      )
    `,
        [
          isHead,
          accountId,
          addressCode,
          checkFamily.length > 0 ? checkFamily[0].familyType : "00A",
          familyRelation,
          JSON.stringify(req.body),
          date,
          date,
          householdId,
        ]
      );
      result = result[0];
      console.log(result, result.length);
      if (result.length > 0) {
        res.status(200).json({ message: `tagged.` });
      } else {
        res.status(500).json({ error: 500, message: `error.` });
      }

      let houseId = (
        await req.db.query(
          `
        SELECT fnHouseholdIdGen(?,?,?,?) as houseId
      `,
          [addressCode, familyType, isHead, accountId]
        )
      ).houseId;
    } catch (err) {
      next(err);
    }
  }

  async verifyTempEmail(req, res, next) {
    let { accountId } = req.currentUser;
    let { email } = req.body;
    try {
      let check = await req.db.query(
        `
        SELECT 
          primaryEmail
        FROM citizen_contacts
        WHERE
          accountId = ? 
      `,
        [accountId]
      );
      if (check.length > 0) {
        if (isEmpty(check[0].primaryEmail)) {
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
            ["EMAIL", email]
          );

          let code = 111111;
          let expIn = "20s";
          let otpdata = {
            type: "EMAIL",
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
              if (!isEmpty(email)) {
                // sendgrid.emailOtp(email, code);
                return res.status(200).json({
                  token: token,
                  message: `The OTP has been sent to your email.`,
                });
              }
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
            if (!global.isEmpty(email)) {
              // sendgrid.emailOtp(email, code);
              return res.status(200).json({
                token: token,
                message: `The OTP has been sent to your email.`,
              });
            }
          }
        } else if (
          isEmpty(check[0].primaryEmail) &&
          isEmpty(check[0].tempEmail)
        ) {
          //both null
          return res.status(401).json({
            error: 401,
            message: "Email not found.",
          });
        } else {
          //either
          return res.status(401).json({
            error: 401,
            message: "Email not found.",
          });
        }
      } else {
        //check 0
        return res.status(401).json({
          error: 401,
          message: "Email not found.",
        });
      }
    } catch (err) {
      next(err);
    }
  }
  async validateCode(req, res, next) {
    let { token, code } = req.body;
    try {
      jwt.verify(token, process.env.jwtSecretKey, async (err, decoded) => {
        if (err) {
          return res
            .status(401)
            .json({ error: 401, message: "Session already expired." });
        }
        if (decoded.code != code) {
          return res
            .status(401)
            .json({ error: 401, message: `Code mismatched.` });
        }

        if (decoded.code == code) {
          return res.status(200).json({ message: `proceed!` });
        }
      });
    } catch (err) {
      next(err);
    }
  }
}
