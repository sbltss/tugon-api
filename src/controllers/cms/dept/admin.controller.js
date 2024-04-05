import moment from "moment";
import mtz from "moment-timezone";
import hash from "#helpers/hash";
import { isEmpty } from "lodash";

export default class Controller {
  async getBrgyUsers(req, res, next) {
    const { cityId } = req.currentUser;
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
        BU.cityId=?
      `,
        cityId
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
  // async getBrgyUsers(req, res, next) {
  //   const { cityId } = req.currentUser;
  //   try {
  //     let result = await req.db.query(
  //       `
  //     SELECT *
  //     FROM
  //       credentials CR
  //     LEFT JOIN
  //       brgy_users BU
  //       USING (accountId)
  //     WHERE
  //       CR.isDeleted = 0 AND
  //       CR.accountType = "brgy" AND
  //       BU.module!= 'admin' AND
  //       BU.cityId=?
  //     `,
  //       cityId
  //     );
  //     return res.status(200).json(result);
  //   } catch (err) {
  //     next(err);
  //   }
  // }
  async addBrgyUser(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { email, ...body } = req.body;
    let { regionId, provinceId, cityId } = req.currentUser;

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
  async getDepartmentTypes(req, res, next) {
    try {
      let result = await req.db.query(`
      SELECT *
      FROM 
        department_types
      WHERE
        isDeleted = 0
      `);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getDepartmentUsers(req, res, next) {
    try {
      const { cityId, type } = req.currentUser;
      let result = await req.db.query(
        `
      SELECT *
      FROM 
        credentials CR
      LEFT JOIN
        department_users DU
        USING (accountId)
      WHERE
        CR.isDeleted = 0 AND
        CR.accountType = "department" AND
        DU.module!= 'admin' AND
        DU.cityId= ? AND
        DU.type= ?
      `,
        [cityId, type]
      );
      return res.status(200).json(result);
    } catch (err) {
      console.error(err);
      next(err);
    }
  }
  async addDepartmentUser(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { email, ...body } = req.body;
    let { regionId, provinceId, cityId, type } = req.currentUser;

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
        await req.db.query(`SELECT fnGenAccountId(2) as accountId`)
      )[0].accountId;

      const credentials = {
        email,
        accountId,
        dateCreated: date,
        dateUpdated: date,
        password: "Barangay2023",
        accountType: "department",
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
        regionId,
        provinceId,
        cityId,
        type,
        dateCreated: date,
        dateUpdated: date,
      };
      let [insertUser] = await transaction.query(
        `
        INSERT INTO 
          department_users
        SET ?
      `,
        user
      );
      if (!insertUser.insertId) throw new Error("Failed to insert credentials");

      await transaction.commit();
      await transaction.release();
      return res.status(200).json({
        data: { ...user, email, accountType: "department" },
        message: `Sucessfully inserted.`,
      });
    } catch (err) {
      console.error(err);
      await transaction.rollback();
      await transaction.release();
      next(err);
    }
  }
  async updateDepartmentUser(req, res, next) {
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
          department_users
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
          department_users
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

      delete val.password;

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
}
