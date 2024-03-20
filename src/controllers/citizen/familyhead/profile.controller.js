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
import { result,isEmpty } from "lodash";

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
    console.log('validate name',err)
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
  async getProfile(req, res, next) {
    let { accountId } = req.currentUser;
    console.log(req.currentUser)
    try {
      let info = await req.db.query(
        `
				SELECT 
          accountId,
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
      let verification = await req.db.query(
        `
        SELECT 
          services,
          status
        FROM citizen_verifystatus
        WHERE
          accountId = ? AND
          services = ?
      `,
        [accountId, "PROFILE"]
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

      let citizenFiles = await req.db.query(`
        SELECT 
          imageId,
          image,
          module,
          type
        FROM citizen_files
        WHERE
          accountId = ? AND
          isDeleted = ?
      `,[accountId,0])
      let citizenso = await req.db.query(`
        SELECT
          F.householdId,
          F.addressCode,
          F.familyType,
          A.unitNo,
          A.houseNo,
          A.street,
          A.phase,
          B.brgyDesc,
          B.cityDesc,
          B.provinceDesc,
          B.regionDesc
        FROM cvms_familymembers F
        LEFT JOIN cvms_addresses A USING(addressCode)
        LEFT JOIN cvms_brgy B USING(brgyId)
        WHERE
          F.accountId = ? AND
          F.isDeleted = ?
      `,[accountId,0])

      info[0].verification = verification;
      info[0].contacts = contacts[0];
      info[0].files = citizenFiles;
      info[0].citizenso = citizenso;
      if (info.length > 0) {
        return res.status(200).json(info[0]);
      } else {
        return res
          .status(401)
          .json({ error: 401, message: `Failed to fetch data.` });
      }
    } catch (err) {
      console.log(err)
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
      console.log(err)
      next(err);
    }
  }

  async updateProfile(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { accountId } = req.currentUser;
    let val = req.body.newBody;
    
    val.dateUpdated = date;
    try {
      let result = await req.db.query(
        `
    		UPDATE citizen_info
    		SET ?
    		WHERE
        accountId = ?
    	`,
        [val, accountId]
      );

      if (result.affectedRows > 0) {
        let auditObj = {
          createdBy: accountId,
          accountId: accountId,
          userPriviledge: "CITIZEN",
          actionType: "UPDATE PROFILE",
          crud: "UPDATE",
          oldValue: JSON.stringify(req.currentUser),
          newValue: JSON.stringify({val}),
          dateCreated: date,
          dateUpdated: date,
        };

        await audit.auditData(req, auditObj);
        return res.status(200).json({ message: `Successfully updated.` });
      } else {
        return res
          .status(400)
          .json({ error: 400, message: `Failed to update.` });
      }
    } catch (err) {
      if (err.code == "ER_DUP_ENTRY") {
        let msg = err.message.split("for")[0];
        return res.status(400).json({ status: 400, message: msg });
      }
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
        console.log('check id',checkId.length)
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
          console.log('insert id',{
            accountId: accountId,
            imageId: uuid,
            image: idn,
            module: "PROFILE",
            type: "PROFILE_ID",
            status:"PENDING",
            dateCreated: date,
            dateUpdated: date,
          })
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

  async verifyTempEmail(req, res, next) {
    let { accountId } = req.currentUser;
    let { email } = req.body;
    try {

      let check = await req.db.query(`
        SELECT 
          primaryEmail,
          tempEmail
        FROM citizen_contacts
        WHERE
          accountId = ? 
      `,[accountId])
      if(check.length > 0){
        if(isEmpty(check[0].primaryEmail) && !isEmpty(check[0].tempEmail)){

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
          
          // let code = randomize("0", 6);
          let code = 111111
          let expIn = "1m";
          let otpdata = {
            type:"EMAIL",
            nval:email,
            code:code,
            dateCreated:date,
            isExpired:0
          }
          if(checkDuration.length > 0){
            if(checkDuration[0].isExpired == 1){
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
              otpdata.token = token
              await req.db.query(`INSERT INTO otplogs SET ?`, otpdata);
              if (!isEmpty(email)) {
                // sendgrid.emailOtp(email, code);
                return res.status(200).json({
                  token: token,
                  message: `The OTP has been sent to your email.`,
                });
              }
            }else{
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
                    otpdata.token = token
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
          }else{
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
            otpdata.token = token
            await req.db.query(`INSERT INTO otplogs SET ?`, otpdata);
            if (!global.isEmpty(email)) {
              // sendgrid.emailOtp(email, code);
              return res.status(200).json({
                token: token,
                message: `The OTP has been sent to your email.`,
              });
            }
          }
        }else if(isEmpty(check[0].primaryEmail) && isEmpty(check[0].tempEmail)){
          //both null
          return res.status(401).json({
            error:401,
            message: "Email not found.",
          });
        }else{
          //either
          return res.status(401).json({
            error:401,
            message: "Email not found.",
          });
        }
      }else{
        //check 0
        return res.status(401).json({
          error:401,
          message: "Email not found.",
        });
      }

      
    } catch (err) {
      next(err);
    }
  }


  async changeEmailRequest(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { accountId } = req.currentUser;
    let { email,password } = req.body;

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

      let checkCredential = await req.db.query(`
        SELECT
          accountId,
          password
        FROM citizen_credential
        WHERE
          accountId = ? 
      `,[accountId])

      if (!(await hash.comparePassword(password, checkCredential[0].password))) {
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
        ["EMAIL", email]
      );
      
      // let code = randomize("0", 6);
      let code = 111111
      let expIn = "20s";
      let otpdata = {
        type:"EMAIL",
        nval:email,
        code:code,
        dateCreated:date,
        isExpired:0
      }
      if(checkDuration.length > 0){
        if(checkDuration[0].isExpired == 1){
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
          otpdata.token = token
          await req.db.query(`INSERT INTO otplogs SET ?`, otpdata);
          if (!isEmpty(email)) {
            // sendgrid.emailOtp(email, code);
            return res.status(200).json({
              token: token,
              message: `The OTP has been sent to your email.`,
            });
          }
        }else{
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
                otpdata.token = token
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
      }else{
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
        otpdata.token = token
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
      console.log(err)
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
  async updateEmail(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { accountId } = req.currentUser;
    let { email, token } = req.body;
    try {
      jwt.verify(token, process.env.jwtSecretKey, async (err, decoded) => {
        if (err) {
          return res
            .status(401)
            .json({ error: 401, message: "Session already expired." });
        }

        let user = await req.db.query(
          `SELECT accountId FROM citizen_contacts WHERE accountId = ?`,
          [decoded.id]
        );
        if (user.length === 0) {
          return res.status(401).json({ message: "User does not exist" });
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
            actionType: "UPDATE EMAIL",
            crud: "UPDATE",
            oldValue: JSON.stringify(req.currentUser),
            newValue: JSON.stringify({
              email: email,
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
      });
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
          oldValue: JSON.stringify(req.currentUser),
          newValue: JSON.stringify({
            oldPass: oldPassword,
            newPass: password,
            password: npass,
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
}
