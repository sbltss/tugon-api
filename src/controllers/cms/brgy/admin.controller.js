import moment from "moment";
import mtz from "moment-timezone";
import hash from "#helpers/hash";
import { isEmpty } from "lodash";

export default class Controller {
  async getBrgyUsers(req, res, next) {
    const { brgyId } = req.currentUser;
    try {
      let result = await req.db.query(
        `
      SELECT *
      FROM 
        credentials CR
      LEFT JOIN
        brgy_users BU
        USING (accountId)
      WHERE
        CR.isDeleted = 0 AND
        CR.accountType = "brgy" AND
        BU.module!= 'admin' AND
        BU.brgyId=?
      `,
        brgyId
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
  async addBrgyUser(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { email, ...body } = req.body;
    let { regionId, provinceId, cityId, brgyId } = req.currentUser;

    const transaction = await req.db.getConnection();
    await transaction.beginTransaction();
    try {
      const checkEmail = await req.db.query(
        `
        SELECT *
        FROM
          credentials
        WHERE
          email= ?
      `,
        email
      );

      if (checkEmail.length > 0)
        return res
          .status(409)
          .json({ error: 409, message: "Email address already in use" });

      const accountId = (
        await req.db.query(`SELECT fnGenAccountId(1) as accountId`)
      )[0].accountId;

      const credentials = {
        email,
        accountId,
        dateCreated: date,
        dateUpdated: date,
        password: "Barangay2023",
        accountType: "brgy",
      };

      let [insertCred] = await transaction.query(
        `
        INSERT INTO 
          credentials
        SET ?
      `,
        credentials
      );
      if (!insertCred.insertId) throw new Error("Failed to insert credentials");

      const user = {
        accountId,
        ...body,
        dateCreated: date,
        dateUpdated: date,
        regionId,
        provinceId,
        cityId,
        brgyId,
      };
      let [insertUser] = await transaction.query(
        `
        INSERT INTO 
          brgy_users
        SET ?
      `,
        user
      );
      if (!insertUser.insertId) throw new Error("Failed to insert credentials");

      await transaction.commit();
      await transaction.release();
      return res.status(200).json({
        data: { ...user, email, accountType: "brgy" },
        message: `Sucessfully inserted.`,
      });
    } catch (err) {
      console.error(err);
      await transaction.rollback();
      await transaction.release();
      next(err);
    }
  }
  async updateBrgyUser(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { email, password, ...val } = req.body;
    let { id } = req.params;
    val.dateUpdated = date;

    const transaction = await req.db.getConnection();
    await transaction.beginTransaction();

    try {
      const [checkUser] = await transaction.query(
        `
        SELECT *
        FROM
          brgy_users
        WHERE
        accountId= ?
      `,
        id
      );

      if (checkUser.length === 0)
        return res
          .status(400)
          .json({ error: 400, message: "Invalid account id" });

      let [updateUser] = await transaction.query(
        `
        UPDATE 
          brgy_users
        SET ?
        WHERE
          accountId = ?
      `,
        [val, id]
      );

      if (updateUser.affectedRows === 0)
        throw new Error("Failed to update user");

      const cred = {};
      if (email) cred.email = email;
      if (password) cred.password = await hash.hashPassword(password);

      if (email || password) {
        let [updateCred] = await transaction.query(
          `
          UPDATE 
            credentials
          SET ?
          WHERE
            accountId = ?
        `,
          [cred, id]
        );

        if (updateCred.affectedRows === 0)
          throw new Error("Failed to update user");
      }

      await transaction.commit();
      await transaction.release();

      return res.status(200).json({
        data: { ...val, accountId: id },
        message: `Sucessfully updated.`,
      });
    } catch (err) {
      console.error(err);
      await transaction.rollaback();
      await transaction.release();
      next(err);
    }
  }

  async getBrgyDeputies(req, res, next) {
    const { brgyId } = req.currentUser;
    try {
      let result = await req.db.query(
        `
      SELECT *
      FROM brgy_deputy
      WHERE
        isDeleted = 0 &&
        brgyId = ?
      `,
        brgyId
      );
      return res.status(200).json(result);
    } catch (err) {
      console.error(err);
      next(err);
    }
  }
  async addBrgyDeputy(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { brgyId } = req.currentUser;
    let val = req.body;
    try {
      val.brgyId = brgyId;
      val.dateCreated = date;
      val.dateUpdated = date;
      val.type = 0;
      console.log(req.files);
      if (!isEmpty(req.files)) {
        console.log("true");
        val.type = 1;
        val.name = req.files.logo[0].path;
      }
      console.log(val);
      let result = await req.db.query(
        `
        INSERT INTO brgy_deputy
        SET ?
      `,
        val
      );
      if (result.insertId > 0) {
        return res
          .status(200)
          .json({ data: val, message: `Sucessfully inserted.` });
      } else {
        return res
          .status(403)
          .json({ error: 403, message: `Failed to insert data.` });
      }
    } catch (err) {
      console.log(err);
      console.error(err);
      next(err);
    }
  }
  async updateBrgyDeputy(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { brgyId } = req.currentUser;
    let val = req.body;
    let { id } = req.params;
    try {
      val.brgyId = brgyId;
      val.type = 0;
      if (!isEmpty(req.files)) {
        val.type = 1;
        val.name = req.files.logo[0].path;
      }
      val.dateUpdated = date;
      console.log("data", val, id);
      let result = await req.db.query(
        `
        UPDATE brgy_deputy
        SET ?
        WHERE
          id = ?
      `,
        [val, id]
      );
      if (result.affectedRows > 0) {
        return res
          .status(200)
          .json({ data: val, message: `Sucessfully updated.` });
      } else {
        return res
          .status(403)
          .json({ error: 403, message: `Failed to updated data.` });
      }
    } catch (err) {
      console.log(err);
      console.error(err);
      next(err);
    }
  }
}
