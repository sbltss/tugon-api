import moment from "moment";
import mtz from "moment-timezone";
import randomize from "randomatic";
import hash from "#helpers/hash";
import global from "#helpers/global";

import audit from "#helpers/audit";
import unlinkFiles from "#helpers/unlinkfiles";

let validateCitizenName = async (req) => {
  let { accountId, newData } = req.body;
  let {firstName, middleName, lastName, suffix, birthdate } = newData;
  
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
    console.log(err)
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
          email
        FROM
        citizen_info
        WHERE
          email LIKE ? AND
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

let getCitizenInfo = async (req,accountId) =>{
  try{
    let citizenInfo = await req.db.query(`
        SELECT C.*,CC.primaryEmail,CC.primaryMobile
        FROM citizen_info C
        LEFT JOIN citizen_contacts CC USING(accountId)
        WHERE
          C.isDeleted = ? AND
          C.accountId = ?
      `,[0,accountId])
      let citizenStatus = await req.db.query(
        `
        SELECT *
        FROM citizen_verifystatus
        WHERE 
          services IN ("PROFILE") AND 
          accountId = ? AND 
          isDeleted = ?
      `,[accountId,0]);
      let citizenFiles = await req.db.query(
        `
        SELECT *
        FROM 
          citizen_files
        WHERE
          module = ? AND 
          isDeleted = ? AND 
          accountId = ?
      `,
        ["PROFILE", 0,accountId]
      );

      let address = await req.db.query(`
        SELECT 
          F.householdId,
          F.addressCode,
          F.accountId,
          F.familyType,
          F.familyRelation,
          A.unitNo,
          A.houseNo,
          A.street,
          A.phase,
          B.brgyDesc,
          B.cityDesc,
          B.provinceDesc,
          B.regionDesc
        FROM cvms_familymembers F
        LEFT JOIN cvms_addresses A ON A.addressCode = F.addressCode
        LEFT JOIN cvms_brgy B ON B.brgyId = A.brgyId
        WHERE
          F.accountId = ?
      `,[accountId])

      let result = citizenInfo.map((i) => {
        i.status = citizenStatus[0].status;
        i.files = citizenFiles;
        i.address = address
        return i;
      });
      return result
  }catch(err){
    next(err)
  }
}
export default class Controller {
  async getLocationAddresses(req,res,next){
    try{
      let result = await req.db.query(`
        SELECT * 
        FROM cvms_brgy
      `)
      return res.status(200).json(result)
    }catch(err){
      next(err)
    }
  }

  async getAddresses(req,res,next){
    try{
      let result = await req.db.query(`
        SELECT * 
        FROM cvms_addresses
        WHERE 
          isDeleted = 0
      `)
      return res.status(200).json(result)
    }catch(err){
      next(err)
    }
  }
  async searchAddress(req,res,next){
    let {brgy,unitNo,houseNo,street,phase} = req.body
    try{
      let qry = []
      let param = []
      if(!global.isEmpty(brgy)){
        qry.push(`AND B.brgyDesc LIKE ?`)
        param.push(`${brgy}%`)
      }
      if(!global.isEmpty(unitNo)){
        qry.push(`AND A.unitNo LIKE ?`)
        param.push(`${unitNo}`)
      }
      if(!global.isEmpty(houseNo)){
        qry.push(`AND A.houseNo LIKE ?`)
        param.push(`${houseNo}%`)
      }
      if(!global.isEmpty(street)){
        qry.push(`AND A.street LIKE ?`)
        param.push(`${street}%`)
      }
      if(!global.isEmpty(phase)){
        qry.push(`AND A.phase LIKE ?`)
        param.push(`${phase}%`)
      }


      let addresses = await req.db.query(`
        SELECT
          A.id,
          A.addressCode,
          A.brgyId,
          A.unitNo,
          A.houseNo,
          A.street,
          A.phase, 
          B.brgyDesc,
          B.cityDesc,
          B.provinceDesc,
          B.regionId
        FROM cvms_addresses A
        LEFT JOIN cvms_brgy B ON B.brgyId = A.brgyId
        WHERE
          A.isDeleted = 0
          ${qry.join('","')}
      `,param )
    
      if(addresses.length == 0) {
        return res.status(200).json(addresses)
      }

      let familyHead = await req.db.query(`
        SELECT 
          F.householdId,
          F.addressCode,
          F.familyType,
          F.accountId,
          F.familyRelation,
          C.firstName,
          C.middleName,
          C.lastName,
          C.suffix,
          C.birthdate,
          C.sex,
          C.familyCode
        FROM cvms_familymembers F
        LEFT JOIN citizen_info C ON C.accountId = F.accountId
        WHERE
          SUBSTR(F.familyType,3,3) = ? AND
          F.isDeleted = ? AND 
          C.isDeleted = ?
      `,['A',0,0])

      let result = addresses.map(a => {
        let head = familyHead.filter(f => f.addressCode === a.addressCode)
        a.familyHeads = head

        return a
      })

      res.status(200).json(result)
    }catch(err){
      next(err)
    }
  }
  async createNewAddress(req,res,next){
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let {brgyId} = req.body
    let val = req.body
    try{
      val.addressCode = (await req.db.query(`SELECT fnAddressCodeGen('${brgyId}') as addressCode`))[0].addressCode
      val.dateCreated = date 
      val.dateUpdated = date
      console.log(val)
      
      let result = await req.db.query(`
        INSERT INTO cvms_addresses
        SET ?
      `,val)

      if(result.insertId > 0){
        return res.status(200).json({message:`Inserted Successfully.`})
      }else{
        return res.status(500).json({error:500,message:`Failed to insert.`})
      }

    }catch(err){
      next(err)
    }
  }

  async updateAddresses(req,res,next){
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let {id} = req.params
    let {brgyId} = req.body
    let val = req.body
    try{
      val.addressCode = (await req.db.query(`SELECT fnAddressCodeGen(${brgyId}) as addressCode`))[0].addressCode
      val.dateUpdated = date
      
      let result = await req.db.query(`
        UPDATE cvms_addresses
        SET ?
        WHERE
          id = ?
      `,[val,id])

      if(result.affectedRows > 0){
        return res.status(200).json({message:`Updated Successfully.`})
      }else{
        return res.status(500).json({error:500,message:`Failed to update.`})
      }
    }catch(err){
      next(err)
    }
  }



  async getCitizensList(req, res, next) {
    try {
      let citizenInfo = await req.db.query(`
        SELECT C.*,CC.primaryEmail,CC.primaryMobile
        FROM citizen_info C
        LEFT JOIN citizen_contacts CC USING(accountId)
        ORDER BY C.id DESC
      `);
      let citizenStatus = await req.db.query(
        `
        SELECT *
        FROM citizen_verifystatus
        WHERE 
          services = ?
      `,
        ["PROFILE"]
      );
      let citizenFiles = await req.db.query(
        `
        SELECT *
        FROM 
          citizen_files
        WHERE
          module = ? AND 
          isDeleted = ?
      `,
        ["PROFILE", 0]
      );

      let result = citizenInfo.map((i) => {
        let status = citizenStatus.filter((s) => s.accountId === i.accountId);
        let files = citizenFiles.filter((f) => f.accountId === i.accountId);

        i.status = status[0].status;
        i.files = files;
        return i;
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
  async searchCitizen(req,res,next){
    let {accountId,firstName,middleName,lastName} = req.body
    try{
      let ucon = [];
      let uparam = []

      if(!global.isEmpty(accountId)){
        ucon.push(`AND accountId = ?`)
        uparam.push(accountId)
      }
      if(!global.isEmpty(firstName)){
        ucon.push(`AND firstName LIKE ?`)
        uparam.push(`${firstName}%`)
      }
      if(!global.isEmpty(middleName)){
        ucon.push(`AND middleName LIKE ?`)
        uparam.push(`${middleName}%`)
      }
      if(!global.isEmpty(lastName)){
        ucon.push(`AND lastName LIKE ?`)
        uparam.push(`${lastName}%`)
      }
      let citizenInfo = await req.db.query(`
        SELECT C.*,CC.primaryEmail,CC.primaryMobile
        FROM citizen_info C
        LEFT JOIN citizen_contacts CC USING(accountId)
        WHERE
          C.isDeleted = 0
          ${ucon.join(" ")}
      `,uparam)

      let citizenStatus = await req.db.query(
        `
        SELECT *
        FROM citizen_verifystatus
        WHERE 
          services IN ("PROFILE","CVMS")
      `);
      let citizenFiles = await req.db.query(
        `
        SELECT *
        FROM 
          citizen_files
        WHERE
          module = ? AND 
          isDeleted = ?
      `,
        ["PROFILE", 0]
      );

      let address = await req.db.query(`
        SELECT 
          F.householdId,
          F.addressCode,
          F.accountId,
          F.familyType,
          F.familyRelation,
          A.unitNo,
          A.houseNo,
          A.street,
          A.phase,
          B.brgyDesc,
          B.cityDesc,
          B.provinceDesc,
          B.regionDesc
        FROM cvms_familymembers F
        LEFT JOIN cvms_addresses A ON A.addressCode = F.addressCode
        LEFT JOIN cvms_brgy B ON B.brgyId = A.brgyId
      `)

      let result = citizenInfo.map((i) => {
        let status = citizenStatus.filter((s) => s.accountId === i.accountId);
        let files = citizenFiles.filter((f) => f.accountId === i.accountId);
        let adds = address.filter((a) => a.accountId === i.accountId);

        i.status = status[0].status;
        i.files = files;
        i.address = adds
        return i;
      });

      return res.status(200).json(result)
    }catch(err){
      console.log(err)
      next(err)
    }
  }
  async searchCitizenTraceData(req, res, next) {
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
      mobileNumber
    } = req.body;
    try {
      let val = JSON.stringify(req.body);

      let checkInfo = await req.db.query(`
        SELECT
          accountId
        FROM citizen_info
        WHERE 
          accountId = ? AND
          isDeleted = ?
      `,[accountId,0])
      if(checkInfo.length > 0){
        let citizenData = await getCitizenInfo(req,checkInfo[0].accountId)
        return res.status(200).json(citizenData);
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
        let citizenData = await getCitizenInfo(req,results[0].accountId)
        return res.status(200).json(citizenData);
      } else {
        return res
          .status(500)
          .json({ error: 500, message: `Failed.` });
      }
    } catch (err) {
      console.log(err)
      if (err.code == "ER_DUP_ENTRY") {
        let msg = err.message.split("for")[0];
        return res.status(400).json({ error: 400, message: msg.trim() });
      }
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
      sex,
      mobileNumber,
      email,
      username,
      password,
      accessCode,
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
          let registrantName = ` ${firstName || ""}${middleName || ""}${
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

      let checkEmail = await req.db.query(
        `
        SELECT
          primaryEmail
        FROM
          citizen_contacts
        WHERE
          primaryEmail LIKE ?

      `,
        [`${email}%`]
      );
      if (checkEmail.length > 0) {
        return res.status(403).json({ message: `Email already been used.` });
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

      next();
    } catch (err) {
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
      familyCode,
    } = req.body;
    try {
      let val = JSON.stringify(req.body);
      let npass = await hash.hashPassword(password);
      let adminId =req.currentUser.accountId
      let result = await req.db.query(
        `
        CALL admin_citizen_registration(
          ?, ?, ?, ?, ?, ?, 
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?
        )`,
        [
          adminId,
          "001",
          firstName,
          middleName,
          lastName,
          suffix,
          birthdate,
          sex,
          email || 'no-email@gmail.com',
          mobileNumber,
          username,
          npass,
          familyCode,
          date,
          date,
          val,
        ]
      );
      let results = result[0];


      if (results.length > 0) {
        return res
          .status(200)
          .json({ data: results[0], message: `Successfully signup.` });
      } else {
        return res
          .status(500)
          .json({ error: 500, message: `Failed to signup.` });
      }
    } catch (err) {
      if (err.code == "ER_DUP_ENTRY") {
        let msg = err.message.split("for")[0];
        return res.status(400).json({ error: 400, message: msg.trim() });
      }
      console.log(err);
      next(err);
    }
  }

  async updateCitizenProfile(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    
    let adminId = req.currentUser.accountId
    let { accountId, oldData, newData } = req.body;
   
    try {
      let validateName = await validateCitizenName(req);
      if (validateName.error === 200) {
        newData.dateUpdated = date;
        let result = await req.db.query(
          `
          UPDATE citizen_info
          SET ?
          WHERE
          accountId = ?
        `,
          [newData, accountId]
        );

        let auditObj = {
          createdBy: adminId,
          accountId: accountId,
          userPriviledge: "CITIZENSO ADMIN",
          actionType: "UPDATE PROFILE",
          crud: "UPDATE",
          oldValue: JSON.stringify(oldData),
          newValue: JSON.stringify(newData),
          dateCreated: date,
          dateUpdated: date,
        };

        await audit.auditData(req, auditObj);
        console.log('resulttttt',result)
        if(result.affectedRows > 0){
          return res.status(200).json({ message: `Successfully updated.` });
        }else{
          return res.status(500).json({error:500, message: `Update errror.` });
        }
      } else {
        return res.status(validateName.error).json(validateName);
      }
    } catch (err) {
      console.log(err)
      next(err);
    }
  }
  async searchHouseholdMembers(req,res,next){
    let {householdId} = req.body
    try{
      let result = await req.db.query(`
        SELECT
          C.accountId,
          F.familyRelation,
          F.familyType,
          C.firstName,
          C.middleName,
          C.lastName,
          C.suffix,
          C.birthdate,
          C.sex
        FROM
          cvms_familymembers F
        LEFT JOIN citizen_info C USING(accountId)
        WHERE
          SUBSTR(F.householdId,1,19) = SUBSTR(?,1,19)
      `,[householdId])
      
      res.status(200).json(result)
    }catch(err){
      next(err)
    }
  }

  async getCitizensoSurvey(req,res,next){
    
    try{
      let result = await req.db.query(`
        SELECT *
        FROM cvms_survey
        WHERE
          isDeleted = 0
      `)

      return res.status(200).json(result)
    }catch(err){
      next(err)
    }
  }

  async answerCitizensoSurvey(req,res,next){
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    
    let {householdId,addressCode,familyHeadId,survey} = req.body
    try{
      let result = await req.db.query(`
        INSERT INTO cvms_surveyanswer
        SET ?
      `,{
        householdId: householdId,
        addressCode:addressCode,
        familyHeadId: familyHeadId,
        answers:JSON.stringify(survey),
        dateCreated:date,
        dateUpdated:date
      })
      if(result.insertId > 0){
        return res.status(200).json({message:`Submitted successfully.`})
      }else{
        return res.status(403).json({error:403,message:`Failed to insert data..`})
      }
    }catch(err){
      console.log(err)
      next(err)
    }
  }


  async uploadSupportingFiles(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let adminId = req.currentUser.accountId
    let { accountId } = req.body;
    let files = req.files;
    let auditStatus

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

        if (checkId.length > 0) {
          auditStatus = "UPDATE"
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
          auditStatus = "CREATE"
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
          auditStatus = "UPDATE"
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
          auditStatus = "CREATE"
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
      let auditObj = {
        createdBy: adminId,
        accountId: accountId,
        userPriviledge: "CITIZENSO ADMIN",
        actionType: "UPLOAD FILES",
        crud: auditStatus,
        newValue: JSON.stringify({ body: req.body, files: req.files }),
        dateCreated: date,
        dateUpdated: date,
      };

      await audit.auditData(req, auditObj);

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

  async changeEmailRequest(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { email, accountId } = req.body;

    try {
      let check = await req.db.query(
        `
        SELECT email
        FROM citizen_contacts 
        WHERE
          primaryEmail LIKE ? AND
          accountId != ?
      `,
        [`${email}%`, accountId]
      );
      if (check.length > 0) {
        return res.status(409).json({
          error: 409,
          message: "The email you tried to enter already exists.",
        });
      }
      let validateEmail = await req.db.query(
        `
        UPDATE citizen_contacts
          SET ?
        WHERE 
          accountId = ?
      `,
        [{ tempEmail: email, dateUpdated: date }, accountId]
      );
      if (validateEmail.affectedRows > 0) {
        let code = randomize("0", 6);
        const token = jwt.sign(
          { id: accountId, code: code },
          process.env.jwtSecretKey,
          {
            expiresIn: "5m",
          }
        );
        await sendgrid.emailOtp(email, code);
        res.status(200).json({
          token: token,
          code: code,
          message: "The OTP has been sent to your new email.",
        });
      } else {
        return res.status(400).json({
          error: 400,
          message: `Failed to change email address, Please try again.`,
        });
      }
    } catch (err) {
      next(err);
    }
  }

  async approveApplication(req,res,next){
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let adminId = req.currentUser.accountId
    let {accountId} = req.body
    let docsStatus
    try{
      let checkDocs = await req.db.query(`
        SELECT * 
        FROM citizen_files
        WHERE accountId = ? 
      `,[accountId])
      if(checkDocs.length > 0){
        let profileID = checkDocs.find(e => e.type === 'PROFILE_ID');
        let profileDocs = checkDocs.find(e => e.type === 'PROFILE_DOCUMENT');

        let val = {
          status:"APPROVED",
          isDeleted: 0,
          dateUpdated: date 
        }
        let result = await req.db.query(
          `
          UPDATE citizen_verifystatus
          SET ?
          WHERE
          accountId = ? AND
          services = ?
        `,
          [val, accountId,'PROFILE']
        );

        
        if(result.affectedRows > 0){
          let auditObj = {
            createdBy: adminId,
            accountId: accountId,
            userPriviledge: "CITIZENSO ADMIN",
            actionType: "UPDATE PROFILE STATUS",
            crud: "UPDATE",
            newValue: JSON.stringify(val),
            dateCreated: date,
            dateUpdated: date,
          };
  
          await audit.auditData(req, auditObj);
          return res.status(200).json({status:'APPROVED', message: `Approved successfully.` });
        }else{
          return res.status(200).json({status:'FAILED', message: `Failed to approve application.` });
        }

      }else{
        return res.status(401).json({error:401,message:'Please upload supporting documents first before approving the application of the citizen.'})
      }
    }catch(err){
      console.log(err)
      next(err)
    }
  }



  async createCitizenso(req,res,next){
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let adminId = req.currentUser.accountId
    
    let {isHead,addressCode,accountId,familyHeadId,familyRelation} = req.body
    try{
      
      let ProfileStatus = await req.db.query(`
      SELECT *
      FROM citizen_verifystatus
      WHERE 
        accountId = ? AND
        services = ? AND
        isDeleted = ? AND 
        status = ?
    `,[accountId,'PROFILE',0,'PENDING'])

      if(ProfileStatus.length > 0 ){
        return res.status(401).json({error:401,message: `Citizen is not yet verified.`})
      }

      let isExists = await req.db.query(`
        SELECT * 
        FROM cvms_familymembers
        WHERE
        accountId = ? AND
        status = ?
      `,[accountId, 1])

      if(isExists.length > 0){
        return res.status(401).json({error:401,message: `Already exists.`})
      }
      let sql
      let param
      if(isHead == 0 && global.isEmpty(familyHeadId)){
        return res.status(401).json({error:401,message: `Maari po lamang na piliin ang inyong haligi ng tahanan upang kayo ay mapabilang sa kanyang pamilya.`})
      }else if(isHead == 0 && !global.isEmpty(familyHeadId)){
        sql = `
          SELECT * 
          FROM cvms_familymembers
          WHERE
          addressCode = ? AND
          SUBSTR(familyType,3,3) = ? AND
          accountId = ?
          ORDER BY familyType DESC LIMIT 1
        `
        param = [addressCode,'A',familyHeadId]
      }else{
        sql = `
          SELECT * 
          FROM cvms_familymembers
          WHERE
          addressCode = ? AND
          SUBSTR(familyType,3,3) = ?
          ORDER BY familyType DESC LIMIT 1
        `
        param = [addressCode,'A']
      }
      let checkFamily = await req.db.query(sql,param)
      if(isHead == 0 && checkFamily.length == 0 ){
        return res.status(401).json({error:401,message:`Maari po lamang na magparehistro muna ang inyong haligi ng tahanan bago ang mga myembro neto.`})
      }

      let result = await req.db.query(`
        CALL household_registration(
          ?, ?, ?, ?, ?,  
          ?, ?, ?, ?
        )
      `,[
        adminId,
        isHead,
        accountId,
        addressCode,
        checkFamily.length > 0 ? checkFamily[0].familyType : '00A',
        familyRelation,
        JSON.stringify(req.body),
        date,
        date
      ])
      result = result[0]
      console.log(result,result.length)
      if(result.length > 0){
        res.status(200).json({message:`tagged.`})
      }else{
        
        res.status(500).json({error:500,message:`error.`})
      }
    }catch(err){
      console.log(err)
      next(err)
    }
  }


  async createAsNewFamilyHead(req,res,next){
    try{

    }catch(err){
      next(err)
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
    let adminId = req.currentUser.accountId
    let { email, token, accountId } = req.body;
    try {
      jwt.verify(token, process.env.jwtSecretKey, async (err, decoded) => {
        if (err) {
          return res
            .status(401)
            .json({ error: 401, message: "Session already expired." });
        }

        let user = await req.db.query(
          `SELECT accountId,primaryEmail,tempEmail FROM citizen_contacts WHERE accountId = ?`,
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
            createdBy: adminId,
            accountId: accountId,
            userPriviledge: "CITIZENSO ADMIN",
            actionType: "UPDATE EMAIL",
            crud: "UPDATE",
            oldValue: JSON.stringify(user[0]),
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


}
