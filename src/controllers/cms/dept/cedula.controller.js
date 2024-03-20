import moment from "moment";
import mtz from "moment-timezone";
import randomize from "randomatic";
import hash from "#helpers/hash";
import global from "#helpers/global";
import {isEmpty} from "lodash"

import audit from "#helpers/audit";
import unlinkFiles from "#helpers/unlinkfiles";


export default class Controller {
  async getCedula(req,res,next){

    try{
      let result = await req.db.query(`
      SELECT 
        C.cedulaId,
        C.accountId,
        C.controlNumber,
        I.firstName,
        I.middleName,
        I.lastName,
        I.suffix,
        I.birthdate,
        I.sex,
        F.imageId,
        F.image,
        F.module,
        F.type,
        C.dateCreated 
      FROM brgy_cedula C
      LEFT JOIN citizen_info I ON I.accountId = C.accountId
      LEFT JOIN citizen_files F ON F.imageId = C.fileId
      WHERE 
        C.isDeleted = 0 AND
        F.type = ? AND
        F.module = ?
      `,["CEDULA","BRGY"])
      return res.status(200).json(result)
    }catch(err){
      next(err)
    }
  }

  async getCedulaById(req,res,next){
    let {id} = req.params
    try{
      let result = await req.db.query(`
      SELECT 
        C.cedulaId,
        C.accountId,
        C.controlNumber,
        I.firstName,
        I.middleName,
        I.lastName,
        I.suffix,
        I.birthdate,
        I.sex,
        F.imageId,
        F.image,
        F.module,
        F.type,
        C.dateCreated 
      FROM brgy_cedula C
      LEFT JOIN citizen_info I ON I.accountId = C.accountId
      LEFT JOIN citizen_files F ON F.imageId = C.fileId
      WHERE 
        C.isDeleted = 0 AND
        F.type = ? AND
        F.module = ? AND
        C.accountId = ?
      `,["CEDULA","BRGY",id])
      return res.status(200).json(result)
    }catch(err){
      next(err)
    }
  }

  async createCedula(req,res,next){
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let {brgyUid,module:mdl,accountType,section} = req.currentUser
    let { accountId,controlNumber } = req.body;
    let files = req.files;
    let transaction;
    try{
      if (Object.keys(files).length === 0) {
        return res.status(400).json({
          error: 400,
          message: "No files were uploaded",
        });
      }else if(isEmpty(files.cedula)){
        return res.status(400).json({
          error: 400,
          message: "No files were uploaded",
        });
      }

      transaction = await req.db.getConnection();

      await transaction.beginTransaction();

      let icn = files.cedula[0].path;
      let [genUUID] = await transaction.query(`SELECT UUID() AS uuid`);
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
            image: icn,
            module: "BRGY",
            type: "CEDULA",
            dateCreated: date,
            dateUpdated: date,
          },
        ]
      );
      if (!insert.insertId) {
        throw {
          error: 500,
          loc: "add cedula file",
          message: "An error occurred. Please try again",
        };
      }
      let [genUUIDFile] = await transaction.query(`SELECT UUID() AS uuidFile`);
      const { uuidFile } = genUUIDFile[0];
      let [insertRecord] = await transaction.query(
        `
        INSERT INTO brgy_cedula
        SET ?  
      `,
        [
          {
            cedulaId: uuidFile,
            accountId: accountId,
            controlNumber: controlNumber,
            fileId:uuid,
            dateCreated: date,
            dateUpdated: date,
          },
        ]
      );
      if (!insertRecord.insertId) {
        throw {
          error: 500,
          loc: "add control number",
          message: "An error occurred. Please try again",
        };
      }
      let auditObj = {
        createdBy: brgyUid,
        accountId: accountId,
        userPriviledge: `${mdl}:${accountType}:${section}`,
        actionType: "UPLOAD CEDULA",
        crud: "CREATE",
        newValue: JSON.stringify({ body: req.body, files: req.files }),
        dateCreated: date,
        dateUpdated: date,
      };

      await audit.auditData(req, auditObj);

      await transaction.commit();
      await transaction.release();
      res.status(200).json({ message: "Files uploaded successfully" });
    }catch(err){
      console.log(err)
      unlinkFiles.unlinkProfileFiles(req.files);
      await transaction.rollback();
      await transaction.release();
      next(err)
    }
  }


}