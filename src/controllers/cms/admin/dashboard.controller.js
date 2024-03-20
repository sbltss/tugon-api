import moment from "moment";
import mtz from "moment-timezone";

export default class Controller {
  async getRegisteredCitizen(req,res,next){
    try{
      let result = await req.db.query(`
        SELECT *
        FROM citizen_info
        WHERE isDeleted = 0
      `)
      return res.status(200).json(result.length)
    }catch(err){
      next(err)
    }
  }

  async getVerifiedCitizen(req,res,next){
    try{
      let result = await req.db.query(`
        SELECT 
          I.accountId,
          V.services,
          V.status
        FROM citizen_info I
        LEFT JOIN citizen_verifystatus V ON V.accountid = I.accountId
        WHERE
          V.services = ? AND
          I.isDeleted = 0
      `,["PROFILE"])
      let unverified = result.filter(v => o.status === "APPROVED")
      let verified = result.filter(v => v.status !== 'APPROVED')
      res.status(200).json({unverified:unverified.length,verified:verified.length})
    }catch(err){
      next(err)
    }
  }

  async getVerifiedQuestionaire(req,res,next){
    try{
      let result = await req.db.query(`
        SELECT
          householdId,
          addressCode,
          familyHeadId,
          isVerified,
          isDeleted
        FROM cvms_surveyanswer
        WHERE 
          isDeleted = 0
      `)
      let unverified = result.filter(v => o.isVerified === 1)
      let verified = result.filter(v => v.isVerified !== 1)
      res.status(200).json({unverified:unverified.length,verified:verified.length})
    }catch(err){
      next(err)
    }
  }

  async getCitizenPerBarangay(req,res,next){
    try{
      let brgy = await req.db.query(`
      SELECT 
        COUNT(F.accountId) as citizens,
        B.brgyDesc,
        SUBSTRING_INDEX(F.addressCode, "-", 1) as brgyId
      FROM cvms_familymembers F
      LEFT JOIN cvms_brgy B ON B.brgyId = SUBSTRING_INDEX(F.addressCode, "-", 1)
      WHERE
        F.isDeleted = 0
      GROUP BY 
        SUBSTRING_INDEX(F.addressCode, "-", 1)
      `)

      return res.status(200).json(brgy)
    }catch(err){
      next(err)
    }
  }

  async getListFamilyHead(req,res,next){
    try{
      let result = await req.db.query(`
      SELECT 
        F.householdId,
          F.addressCode,
          F.accountId,
          I.firstName,
          I.middleName,
          I.lastName,
          I.suffix,
          I.birthdate,
          I.sex
          
      FROM cvms_familymembers F 
      LEFT JOIN citizen_info I ON I.accountId = F.accountId
      WHERE 
        substr(F.familyType,-1) = 'A' AND
          F.isDeleted = 0 AND 
          I.isDeleted = 0
      `)

      return res.status(200).json(result)
    }catch(err){
      next(err)
    }
  }
  async getListUsers(req,res,next){
    try{
      let result = await req.db.query(`
      SELECT 
        I.accountId,
        I.firstName,
        I.middleName,
        I.lastName,
        I.suffix,
        I.birthdate,
        I.sex,
        (SELECT status FROM citizen_verifystatus WHERE services = "PROFILE" AND accountId = I.accountId ) as isVerified
      FROM citizen_info I
      WHERE
        I.isDeleted = 0
      `)
      return res.status(200).json(result)
    }catch(err){
      next(err)
    }
  }
}