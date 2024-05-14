import moment from "moment";
import mtz from "moment-timezone";
import randomize from "randomatic";
import hash from "#helpers/hash";
import global from "#helpers/global";
import { isEmpty } from "lodash";

import audit from "#helpers/audit";
import unlinkFiles from "#helpers/unlinkfiles";

export default class Controller {
  async createSeniorId(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { accountId } = req.currentUser;
    let { seniorId, ...rest } = req.body;
    let files = req.files;
    let transaction;
    try {
      const checkSeniorId = await req.db.query(
        `
        SELECT *
        FROM 
          department_senior_id
        WHERE
          accountId = ?
      `,
        accountId
      );

      if (checkSeniorId.length > 0)
        return res
          .status(409)
          .json({ error: 409, message: "Duplicate senior id" });

      transaction = await req.db.getConnection();
      await transaction.beginTransaction();

      let icn = files.document[0].path;
      let [genUUID] = await transaction.query(`SELECT UUID() AS uuid`);
      const { uuid } = genUUID[0];
      let [genSeniorUUID] = await transaction.query(
        `SELECT UUID() AS seniorUuid`
      );
      const { seniorUuid } = genSeniorUUID[0];

      let [insertInfo] = await transaction.query(
        `
        INSERT INTO citizen_osca_info
        SET ?  
      `,
        [
          {
            seniorId: seniorUuid || seniorId,
            accountId: accountId,
            ...rest,
            dateOfRegistration: date,
            dateCreated: date,
            dateUpdated: date,
          },
        ]
      );

      if (!insertInfo.insertId) {
        throw {
          error: 500,
          loc: "add senior info",
          message: "An error occurred. Please try again",
        };
      }

      let [insertSectors] = await transaction.query(
        `
        INSERT INTO citizen_sectors
        SET ?  
      `,
        [
          {
            accountId: accountId,
            sectorId: 4,
            status: "PENDING",
            dateCreated: date,
            dateUpdated: date,
          },
        ]
      );

      if (!insertSectors.insertId) {
        throw {
          error: 500,
          loc: "add senior info",
          message: "An error occurred. Please try again",
        };
      }

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
            module: "CITIZEN",
            type: "SENIOR_DOCUMENT",
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

      for (const file of files.id) {
        let [genIdUUID] = await transaction.query(`SELECT UUID() AS idUuid`);
        const { idUuid } = genIdUUID[0];

        let [insertId] = await transaction.query(
          `
          INSERT INTO citizen_files
          SET ?  
        `,
          [
            {
              accountId: accountId,
              imageId: idUuid,
              image: file.path,
              module: "CITIZEN",
              type: "SENIOR_ID",
              dateCreated: date,
              dateUpdated: date,
            },
          ]
        );

        if (!insertId.insertId) {
          throw {
            error: 500,
            loc: "add seniorid file",
            message: "An error occurred. Please try again",
          };
        }
      }

      let [insertRecord] = await transaction.query(
        `
        INSERT INTO department_senior_id
        SET ?  
      `,
        [
          {
            seniorId: seniorUuid || seniorId,
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
        createdBy: accountId,
        accountId: accountId,
        userPriviledge: `CITIZEN`,
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
