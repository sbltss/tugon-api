import moment from "moment";
import mtz from "moment-timezone";
import hash from "#helpers/hash";
import { isEmpty } from "lodash";
import unlinkFiles from "#helpers/unlinkfiles";

export default class Controller {
  async getEstablishments(req, res, next) {
    let response = [];

    try {
      let result = await req.db.query(`
        SELECT 
          E.*,
          ET.name AS establishmentTypeName,
          CI.firstName AS ownerFirstName,
          CI.middleName AS ownerMiddleName,
          CI.lastName AS ownerLastName
        FROM establishments E
        LEFT JOIN establishment_type ET ON ET.id = E.establishmentType
        LEFT JOIN citizen_info CI ON CI.accountId = E.ownerId
        WHERE 
          E.status = 0
        ORDER BY E.id DESC
      `);

      for (const file of result) {
        let files = await req.db.query(
          `
          SELECT *
          FROM establishment_files
          WHERE
            establishmentId = ? AND
            status = 0
        `,
          file.establishmentId
        );

        response.push({
          ...file,
          files,
        });
      }

      return res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async addEstablishment(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let val = { ...req.body };
    let { file } = req.files;

    let transaction;
    try {
      if (Object.keys(file).length === 0) {
        return res.status(400).json({
          error: 400,
          message: "No files were uploaded",
        });
      } else if (isEmpty(file)) {
        return res.status(400).json({
          error: 400,
          message: "No files were uploaded",
        });
      }

      val.status = 0;
      val.dateCreated = date;
      val.dateUpdated = date;

      let validate = await req.db.query(
        `
        SELECT * 
        FROM citizen_info
        WHERE
          accountId = ?
      `,
        val.ownerId
      );

      if (validate.length === 0) {
        return res
          .status(403)
          .json({ error: 403, message: `User account not found.` });
      }

      transaction = await req.db.getConnection();

      await transaction.beginTransaction();

      let [genUUID] = await transaction.query(`SELECT UUID() AS uuid`);
      const { uuid } = genUUID[0];
      val.establishmentId = uuid;

      let [insert] = await transaction.query(
        `
        INSERT INTO establishments
        SET ?
      `,
        val
      );

      if (!insert.insertId) {
        throw {
          error: 500,
          message: "An error occurred. Please try again",
        };
      }

      for (const newFile of file) {
        let [genUUIDFile] = await transaction.query(
          `SELECT UUID() AS uuidFile`
        );
        const { uuidFile } = genUUIDFile[0];

        let [insertFile] = await transaction.query(
          `
          INSERT INTO establishment_files
          SET ?
        `,
          {
            establishmentId: uuid,
            fileId: uuidFile,
            file: newFile.path,
            status: 0,
            dateCreated: date,
            dateUpdated: date,
          }
        );

        if (!insertFile.insertId) {
          throw {
            error: 500,
            message: "An error occurred. Please try again",
          };
        }
      }

      await transaction.commit();
      await transaction.release();
      res.status(200).json({ message: "Added successfully" });
    } catch (err) {
      unlinkFiles.unlinkProfileFiles(req.files);
      await transaction.rollback();
      await transaction.release();
      next(err);
      next(err);
    }
  }

  async updateEstablishment(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { establishmentId } = req.params;
    let val = req.body;
    try {
      val.dateUpdated = date;

      let validate = await req.db.query(
        `
        SELECT * 
        FROM citizen_info
        WHERE
          accountId = ?
      `,
        val.ownerId
      );

      if (validate.length === 0) {
        return res
          .status(403)
          .json({ error: 403, message: `User account not found.` });
      }

      let result = await req.db.query(
        `
        UPDATE establishments
        SET ?
        WHERE
          establishmentId = ?
      `,
        [val, establishmentId]
      );

      if (result.affectedRows > 0) {
        return res.status(200).json({ message: `Updated Successfully.` });
      } else {
        return res
          .status(500)
          .json({ error: 500, message: `Failed to update.` });
      }
    } catch (err) {
      next(err);
    }
  }

  async removeEstablishment(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { establishmentId } = req.params;
    let val = {};

    try {
      val.status = 1;
      val.dateUpdated = date;

      let result = await req.db.query(
        `
        UPDATE establishments
        SET ?
        WHERE
          establishmentId = ?
      `,
        [val, establishmentId]
      );

      if (result.affectedRows > 0) {
        return res.status(200).json({ message: `Remove Successfully.` });
      } else {
        return res
          .status(500)
          .json({ error: 500, message: `Failed to update.` });
      }
    } catch (err) {
      next(err);
    }
  }

  async addEstablishmentFile(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { establishmentId } = req.params;
    let { file } = req.files;

    let transaction;
    try {
      if (Object.keys(file).length === 0) {
        return res.status(400).json({
          error: 400,
          message: "No files were uploaded",
        });
      } else if (isEmpty(file)) {
        return res.status(400).json({
          error: 400,
          message: "No files were uploaded",
        });
      }

      transaction = await req.db.getConnection();

      await transaction.beginTransaction();

      for (const newFile of file) {
        let [genUUIDFile] = await transaction.query(
          `SELECT UUID() AS uuidFile`
        );
        const { uuidFile } = genUUIDFile[0];

        let [insertFile] = await transaction.query(
          `
          INSERT INTO establishment_files
          SET ?
        `,
          {
            establishmentId: establishmentId,
            fileId: uuidFile,
            file: newFile.path,
            status: 0,
            dateCreated: date,
            dateUpdated: date,
          }
        );

        if (!insertFile.insertId) {
          throw {
            error: 500,
            message: "An error occurred. Please try again",
          };
        }
      }

      await transaction.commit();
      await transaction.release();
      res.status(200).json({ message: "Added successfully" });
    } catch (err) {
      unlinkFiles.unlinkProfileFiles(req.files);
      await transaction.rollback();
      await transaction.release();
      next(err);
      next(err);
    }
  }

  async removeEstablishmentFile(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { fileId } = req.params;
    let val = {};

    try {
      val.status = 1;
      val.dateUpdated = date;

      let validate = await req.db.query(
        `
        SELECT * 
        FROM establishment_files
        WHERE
          fileId = ?
      `,
        fileId
      );

      if (validate.length === 0) {
        return res.status(403).json({ error: 403, message: `File not found.` });
      }

      let result = await req.db.query(
        `
          UPDATE establishment_files
          SET ?
          WHERE
            fileId = ?
        `,
        [val, fileId]
      );

      if (result.affectedRows > 0) {
        await unlinkFiles.unlinkImages(validate[0].file);
        return res.status(200).json({ message: `Remove Successfully.` });
      } else {
        return res
          .status(500)
          .json({ error: 500, message: `Failed to update.` });
      }
    } catch (err) {
      next(err);
    }
  }

  async getEstablishmentTypes(req, res, next) {
    try {
      let result = await req.db.query(`
        SELECT 
          *
        FROM establishment_type
        WHERE 
          status = 0
      `);

      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async addEstablishmentType(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    const { name } = req.body;

    let val = {};
    try {
      val.name = name.toUpperCase();
      val.status = 0;
      val.dateCreated = date;
      val.dateUpdated = date;

      console.log(val.name.trim());

      let validate = await req.db.query(
        `
        SELECT *
        FROM establishment_type
        WHERE
          name = ? AND
          status = 0
      `,
        val.name.replace(/\s/g, "")
      );

      if (validate.length > 0) {
        return res.status(409).json({
          error: 409,
          message: "Establishment type is already existing.",
        });
      }

      let result = await req.db.query(
        `
        INSERT INTO establishment_type
        SET ?
      `,
        val
      );

      if (result.insertId > 0) {
        return res.status(200).json({ message: `Sucessfully inserted.` });
      } else {
        return res
          .status(403)
          .json({ error: 403, message: `Failed to insert data.` });
      }
    } catch (err) {
      next(err);
    }
  }

  async updateEstablishmentType(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { id } = req.params;
    let val = req.body;
    try {
      val.dateUpdated = date;

      let result = await req.db.query(
        `
        UPDATE establishment_type
        SET ?
        WHERE
          id = ?
      `,
        [val, id]
      );

      if (result.affectedRows > 0) {
        return res.status(200).json({ message: `Updated Successfully.` });
      } else {
        return res
          .status(500)
          .json({ error: 500, message: `Failed to update.` });
      }
    } catch (err) {
      next(err);
    }
  }

  async removeEstablishmentType(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { id } = req.params;
    let val = {};

    try {
      val.status = 1;
      val.dateUpdated = date;

      let result = await req.db.query(
        `
        UPDATE establishment_type
        SET ?
        WHERE
          id = ?
      `,
        [val, id]
      );

      if (result.affectedRows > 0) {
        return res.status(200).json({ message: `Remove Successfully.` });
      } else {
        return res
          .status(500)
          .json({ error: 500, message: `Failed to update.` });
      }
    } catch (err) {
      next(err);
    }
  }
}
