import moment from "moment";
import mtz from "moment-timezone";
import jwt from "jsonwebtoken";
import randomize from "randomatic";
import hash from "#helpers/hash";
import global from "#helpers/global";

import { result } from "lodash";



export default class Controller {
  async getScannedEstablishment(req,res,next){
    let {accountId} = req.currentUser
    try{

      let result = await req.dbe.query(`
        SELECT 
          S.merchantId,
          S.remarks,
          S.scanType,
          S.dateScanned,
          M.name
        FROM merchantscan S
        LEFT JOIN merchant M ON M.accountId = S.merchantId
        WHERE
          constituentId = ?
        GROUP BY S.dateScanned
        ORDER BY S.dateScanned DESC

      `,[accountId])
      console.log(result,accountId)
      return res.status(200).json(result)
    }catch(err){
      next(err)
    }
  }
}
