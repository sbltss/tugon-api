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
  async getCitizenInformation(req,res,next){
    let {familyMemberId} = req.body
    try{
      let result = await req.db.query(`
        SELECT 
          accountId,
          firstName,
          middleName,
          lastName,
          suffix,
          birthdate,
          sex,
        FROM citizen_info
        WHERE 
          accountId = ? 
      `,[familyMemberId])

      res.status(200).json(result)
    }catch(err){
      next(err)
    }
  }

  async getAnsweredSurvey(req,res,next){
    let {householdId} = req.currentUser.cvmsInfo
    try{
      let answer = await req.db.query(`
        SELECT * FROM cvms_surveyanswer'
        WHERE householdId = ?
      `,[householdId])

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

}
