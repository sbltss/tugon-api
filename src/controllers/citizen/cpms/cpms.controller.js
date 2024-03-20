import moment from "moment";
import mtz from "moment-timezone";
import fs from "fs";
import randomize from "randomatic";
import SendGrid from "#helpers/sendgrid";
import global from "#helpers/global";

import audit from "#helpers/audit";
import unlinkFiles from "#helpers/unlinkfiles";
import { result } from "lodash";

let sendgrid = new SendGrid();


export default class Controller {

  async validateCitizenProfileStatus(req,res,next){
    let arr = req.currentUser.verification
    let body = (arr.filter(i=> i.services ==="PROFILE"))[0]
    let {accountId,services,status} = body
    try{
      if(services === "PROFILE" && status == "PENDING"){
        return res.status(401).json({error:401,message:`Please verify your account first.`})
      }else{
        next()
      }

    }catch(err){
      next(err)
    }
  }
  async headSearchMember(req,res,next){
    let {accountId} = req.currentUser
    let {familyMemberId} = req.body
    try{

      if(familyMemberId === accountId){
        return res.status(401).json({error:401,message:`Family member not found.`})
      }

      let checkProfileStatus = req.db.query(`
        SELECT * 
        FROM citizen_verifystatus
        WHERE
          accountId = ? AND
          services = ? AND
          status = ? AND
          isDeleted = ?
      `,[familyMemberId,"PROFILE","APPROVED",0])

      if(checkProfileStatus.length === 0 ){
        return res.status(401).json({error:401,message:`It seems your family member is not yet verified.`})
      }


      let info = await req.db.query(`
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
      `,[familyMemberId])

      if(info.length === 0){
        return res.status(401).json({error:401,message:`Citizen not found.`})
      }
      let files = await req.db.query(`
        SELECT *
        FROM citizen_files
        WHERE 
          accountId = ? AND
          isDeleted = ?
      `,[familyMemberId,0])

      let obj = {
        info:info[0],
        files:files
      }

      res.status(200).json(obj)
    }catch(err){
      console.log(err)
      next(err)
    }
  }
 
  async createFamilyTree(req,res,next){
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let {accountId,householdId,addressCode,familyType} = req.currentUser.cvmsInfo
    
    let {
      familyMemberId,
      familyRelation
    } = req.body
    try{

      let checkIfTag = await req.db.query(`
        SELECT 
          householdId,
          addressCode,
          familyType,
          accountId
        FROM cvms_familymembers
        WHERE
          accountId = ? AND
          isDeleted = ?
      `,[familyMemberId,0])

      if(checkIfTag.length > 0){
        let ftype = checkIfTag[0].familyType
        if(ftype.substr(3,3) == "B" && checkIfTag[0].addressCode != addressCode){
          return res.status(401).json({error:401,message:`Citizen already tagged in another family member.`})
        }

        return res.status(401).json({error:401,message:`Citizen already tagged as family member.`})
      }

      let checkStatus = await req.db.query(`
        SELECT
          accountId,
          services,
          status,
          isDeleted
        FROM citizen_verifystatus
        WHERE
          accountId = ? AND 
          services = ? AND
          status != ? AND
          isDeleted = ?
      `,[familyMemberId,"PROFILE","APPROVED",0])
      if(checkStatus.length > 0){
        return res.status(401).json({error:401,message:`Citizen is not yet verified failed to tag as family member.`})
      }


      let famType = familyType.substr(0,2)+"B"
      let val = {
        householdId: [addressCode,famType,familyMemberId].join("-"),
        addressCode:addressCode,
        familyType:famType,
        accountId:familyMemberId,
        familyRelation:familyRelation,
        status:0,
        isDeleted:0,
        dateCreated:date,
        dateUpdated:date
      }

      let rs = await req.db.query(`
        INSERT INTO cvms_familymembers
        SET ?
      `,val)
      if(rs.insertId > 0){
        let auditObj = {
          createdBy: accountId,
          accountId: accountId,
          userPriviledge: "CITIZEN",
          actionType: "ADD FAMILY MEMBER",
          crud: "CREATE",
          newValue: JSON.stringify({val}),
          dateCreated: date,
          dateUpdated: date,
        };

        await audit.auditData(req, auditObj);
        return res.status(200).json({message:`Success`})
      }else{
        return res.status(403).json({error:403,message:`Failed`})
      }


    }catch(err){
      console.log(err)
      next(err)
    }
  }

  async getFamilyTree(req,res,next){
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let {addressCode,familyType} = req.currentUser.cvmsInfo
    try{
      let famType = familyType.substr(0,2)
      let result = await req.db.query(`
      SELECT
        F.householdId,
        F.addressCode,
        F.familyType,
        C.accountId,
        C.firstName,
        C.middleName,
        C.lastName,
        C.suffix,
        C.birthdate,
        C.sex,
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
      LEFT JOIN citizen_info C USING(accountId)
      WHERE
        F.addressCode = ? AND
        F.familyType = ? AND
        F.isDeleted = ? 
    `,[addressCode,famType,0])
    return res.status(200).json(result)
    }catch(err){
      next(err)
    }
  }

  async getCPMSSurvey(req,res,next){
    
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

  async answerCPMSSurvey(req,res,next){
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

  async getAnsweredSurvey(req,res,next){
    let {householdId} = req.currentUser.cvmsInfo
    try{
      let answer = await req.db.query(`
        SELECT * FROM cvms_surveyanswer
        WHERE householdId = ?
      `,[householdId])
      if(answer.length === 0){
        return res.status(403).json({error:403,message:`No survey found.`})
      }
      let loc = await req.db.query(`
        SELECT 
          A.addressCode,
          A.unitNo,
          A.houseNo,
          A.street,
          A.phase,
          A.recidencyDate,
          A.brgyId,
          B.brgyDesc,
          B.cityId,
          B.cityDesc,
          B.provinceId,
          B.provinceDesc,
          B.regionId,
          B.regionDesc
          FROM cvms_addresses A
        LEFT JOIN cvms_brgy B USING(brgyId)
        WHERE
          A.addressCode = ?
      `,[answer[0].addressCode])

      let headDetail = await req.db.query(`
        SELECT
          I.accountId,
          I.firstName,
          I.middleName,
          I.lastName,
          I.suffix,
          I.birthdate,
          I.sex,
          I.isVoter,
          I.voterNumber,
          I.voterLocation
        FROM citizen_info I 
        WHERE
          I.accountId = ?
      `,[answer[0].familyHeadId])
      let famMembers = await req.db.query(`
        SELECT 
          M.householdId,
          M.addressCode,
          M.familyType,
          M.accountId,
          M.familyRelation,
          I.firstName,
          I.middleName,
          I.lastName,
          I.suffix,
          I.birthdate,
          I.sex
        FROM cvms_familymember M 
        LEFT JOIN citizen_info I USING(accountId)
        WHERE
          SUBSTR(M.householdId,1,19) = ?
      `,[householdId.substr(0,19)])

      let obj = {
        headDetails:headDetail[0],
        headLoc: loc[0],
        famMembers:famMembers,
        surveyAnswer:JSON.parse(answer)
      }
      return res.status(200).json(obj)
    }catch(err){
      next(err)
    }
  }

  async updateAnsweredSurvey(req,res,next){
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    
    let {householdId,familyHeadId,survey} = req.body
    try{
      let result = await req.db.query(`
        UPDATE cvms_surveyanswer
        SET ?
        WHERE
        householdId = ? AND
        familyHeadId = ?
      `,[{
        answers:JSON.stringify(survey),
        dateUpdated:date
      },householdId,familyHeadId])
      if(result.insertId > 0){
        return res.status(200).json({message:`Submitted successfully.`})
      }else{
        return res.status(403).json({error:403,message:`Failed to update data..`})
      }
    }catch(err){
      console.log(err)
      next(err)
    }
  }


}
