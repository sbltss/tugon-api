import moment from "moment";
import mtz from "moment-timezone";
import randomize from "randomatic";
import hash from "#helpers/hash";
import global from "#helpers/global";
import { isEmpty } from "lodash";

import audit from "#helpers/audit";
import unlinkFiles from "#helpers/unlinkfiles";

export default class Controller {
  async getSeniorIds(req, res, next) {
    try {
      let result = await req.db.query(
        `
      SELECT 
        ID.seniorId,
        ID.accountId,
        ID.type AS idType,
        ID.dateCreated,
        I.firstName,
        I.middleName,
        I.lastName,
        I.suffix,
        I.birthdate,
        I.sex,
        F.imageId,
        F.image,
        F.module,
        F.type
      FROM department_senior_id ID
      LEFT JOIN citizen_info I ON I.accountId = ID.accountId
      LEFT JOIN citizen_files F ON F.imageId = ID.fileId
      WHERE 
        ID.isDeleted = 0 AND
        F.type = ? AND
        F.module = ?
      `,
        ["SENIORID", "DEPARTMENT"]
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getSeniorIdsById(req, res, next) {
    let { id } = req.params;
    try {
      let result = await req.db.query(
        `
      SELECT 
        ID.seniorId,
        ID.accountId,
        ID.type AS idType,
        ID.dateCreated,
        I.firstName,
        I.middleName,
        I.lastName,
        I.suffix,
        I.birthdate,
        I.sex,
        F.imageId,
        F.image,
        F.module,
        F.type
      FROM department_senior_id ID
      LEFT JOIN citizen_info I ON I.accountId = ID.accountId
      LEFT JOIN citizen_files F ON F.imageId = ID.fileId
      WHERE 
        ID.isDeleted = 0 AND
        F.type = ? AND
        F.module = ? AND
        ID.accountId = ?
      `,
        ["SENIORID", "DEPARTMENT", id]
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async createSeniorId(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let {
      accountId: departmentUid,
      module: mdl,
      accountType,
      section,
    } = req.currentUser;
    let { accountId, seniorId } = req.body;
    let files = req.files;
    let transaction;
    try {
      if (Object.keys(files).length === 0) {
        return res.status(400).json({
          error: 400,
          message: "No files were uploaded",
        });
      } else if (isEmpty(files.documentImage)) {
        return res.status(400).json({
          error: 400,
          message: "No files were uploaded",
        });
      }

      const checkSeniorId = await req.db.query(
        `
        SELECT *
        FROM 
          department_senior_id
        WHERE
          seniorId=?
      `,
        seniorId
      );

      if (checkSeniorId.length > 1)
        return res
          .status(409)
          .json({ error: 409, message: "Duplicate senior id" });

      transaction = await req.db.getConnection();

      await transaction.beginTransaction();

      let icn = files.documentImage[0].path;
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
            module: "DEPARTMENT",
            type: "SENIORID",
            dateCreated: date,
            dateUpdated: date,
          },
        ]
      );
      if (!insert.insertId) {
        throw {
          error: 500,
          loc: "add seniorid file",
          message: "An error occurred. Please try again",
        };
      }
      let [insertRecord] = await transaction.query(
        `
        INSERT INTO department_senior_id
        SET ?  
      `,
        [
          {
            seniorId: seniorId,
            accountId: accountId,
            type: "department_senior_id",
            fileId: uuid,
            dateCreated: date,
            dateUpdated: date,
          },
        ]
      );
      if (!insertRecord.insertId) {
        throw {
          error: 500,
          loc: "add seniorId number",
          message: "An error occurred. Please try again",
        };
      }
      let auditObj = {
        createdBy: departmentUid,
        accountId: accountId,
        userPriviledge: `${mdl}:${accountType}:${section}`,
        actionType: "UPLOAD SENIORID",
        crud: "CREATE",
        newValue: JSON.stringify({ body: req.body, files: req.files }),
        dateCreated: date,
        dateUpdated: date,
      };

      await audit.auditData(req, auditObj);

      await transaction.commit();
      await transaction.release();
      res.status(200).json({ message: "Files uploaded successfully" });
    } catch (err) {
      console.log(err);
      unlinkFiles.unlinkProfileFiles(req.files);
      await transaction.rollback();
      await transaction.release();
      next(err);
    }
  }
}
