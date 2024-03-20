import moment from "moment";
import mtz from "moment-timezone";

export default class Controller {
  async sectorLists(req, res, next) {
    try {
      let result = await req.db.query(`
      SELECT *
      FROM cms_sectors
      WHERE
        isDeleted = 0
      `);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
  async createSector(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let val = req.body;
    try {
      val.dateCreated = date;
      val.dateUpdated = date;

      let result = await req.db.query(
        `
        INSERT INTO cms_sectors
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
  async updateSector(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let val = req.body;
    let { id } = req.params;
    try {
      val.dateUpdated = date;
      let result = await req.db.query(
        `
        UPDATE cms_sectors
        SET ?
        WHERE
          id = ?
      `,
        [val, id]
      );
      if (result.affectedRows > 0) {
        return res.status(200).json({ message: `Sucessfully updated.` });
      } else {
        return res
          .status(403)
          .json({ error: 403, message: `Failed to updated data.` });
      }
    } catch (err) {
      next(err);
    }
  }
  async removeSector(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { id } = req.params;
    let val = {
      isDeleted: 1,
      dateUpdated: date,
    };
    try {
      val.dateUpdated = date;
      let result = await req.db.query(
        `
        UPDATE cms_sectors
        SET ?
        WHERE
          id = ?
      `,
        [val, id]
      );
      if (result.affectedRows > 0) {
        return res.status(200).json({ message: `Sucessfully updated.` });
      } else {
        return res
          .status(403)
          .json({ error: 403, message: `Failed to updated data.` });
      }
    } catch (err) {
      next(err);
    }
  }
}
