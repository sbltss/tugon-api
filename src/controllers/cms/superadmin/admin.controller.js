import moment from "moment";
import mtz from "moment-timezone";
import randomize from "randomatic";
import hash from "#helpers/hash";
import global from "#helpers/global";

import audit from "#helpers/audit";
import unlinkFiles from "#helpers/unlinkfiles";

export default class Controller {
  async accountLists(req, res, next) {
    try {
      let result = await req.db.query(`
      SELECT *
      FROM cms_accounts
      WHERE
        isDeleted = 0
      `);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
  async createAccount(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let val = req.body;
    try {
      val.accountId = (await req.db.query(`SELECT uuid() as uuid`))[0].uuid;
      val.dateCreated = date;
      val.dateUpdated = date;

      let result = await req.db.query(
        `
        INSERT INTO cms_accounts
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
  async updateAccount(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let val = req.body;
    let { id } = req.params;
    try {
      val.dateUpdated = date;
      let result = await req.db.query(
        `
        UPDATE cms_accounts
        SET ?
        WHERE
          accountId = ?
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
  async removeAccount(req, res, next) {
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
        UPDATE cms_accounts
        SET ?
        WHERE
          accountId = ?
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
  async addDepartmentTypes(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let body = req.body;
    body.dateCreated = date;
    body.dateUpdated = date;
    try {
      let insertType = await req.db.query(
        `
        INSERT INTO 
          department_types
        SET ?
      `,
        body
      );
      if (!insertType.insertId) throw new Error("Failed to insert type");

      return res.status(200).json({
        data: body,
        message: `Sucessfully inserted.`,
      });
    } catch (err) {
      console.error(err);
      next(err);
    }
  }
  async updateDepartmentType(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let body = req.body;
    let { id } = req.params;
    body.dateUpdated = date;

    try {
      let updateType = await req.db.query(
        `
        UPDATE 
          department_types
        SET ?
        WHERE
          id = ?
      `,
        [body, id]
      );

      if (updateType.affectedRows === 0)
        throw new Error("Failed to department type");

      return res.status(200).json({
        data: body,
        message: `Sucessfully updated.`,
      });
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async getBrgyUsers(req, res, next) {
    try {
      let result = await req.db.query(`
      SELECT *
      FROM 
        credentials CR
      LEFT JOIN
        brgy_users BU
        USING (accountId)
      WHERE
        CR.isDeleted = 0 AND
        CR.accountType = "brgy" AND
        BU.module= 'admin'
      `);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
  async addBrgyUser(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { email, ...body } = req.body;

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
        module: "admin",
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

  async getDepartmentUsers(req, res, next) {
    try {
      let result = await req.db.query(`
      SELECT *
      FROM 
        credentials CR
      LEFT JOIN
        department_users DU
        USING (accountId)
      LEFT JOIN
        city_users CU ON 
        CU.accountId = DU.cityAccountId
      WHERE
        CR.isDeleted = 0 AND
        CR.accountType = "department" AND
        DU.module= 'admin'
      `);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
  async addDepartmentUser(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { email, ...body } = req.body;

    const transaction = await req.db.getConnection();
    await transaction.beginTransaction();
    try {
      const existing = await req.db.query(
        `
        SELECT *
        FROM
          department_users
        WHERE
          cityAccountId = ? AND
          type = ?
      `,
        [body.cityAccountId, body.type]
      );

      if (existing.length > 0)
        return res.status(409).json({
          error: 409,
          message: "Registration Failed. One account only per department.",
        });

      const checkEmail = await req.db.query(
        `
        SELECT *
        FROM
          credentials
        WHERE
          email= ? AND
          isDeleted = 0
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
        dateCreated: date,
        dateUpdated: date,
        module: "admin",
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

  async getCityUsers(req, res, next) {
    try {
      let result = await req.db.query(`
      SELECT *
      FROM 
        credentials CR
      LEFT JOIN
        city_users CU
        USING (accountId)
      WHERE
        CR.isDeleted = 0 AND
        CR.accountType = "city" AND
        CU.module= 'admin'
      `);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
  async addCityUser(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { email, ...body } = req.body;

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
        accountType: "city",
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
        module: "admin",
      };
      let [insertUser] = await transaction.query(
        `
        INSERT INTO 
          city_users
        SET ?
      `,
        user
      );
      if (!insertUser.insertId) throw new Error("Failed to insert credentials");

      await transaction.commit();
      await transaction.release();
      return res.status(200).json({
        data: { ...user, email, accountType: "city" },
        message: `Sucessfully inserted.`,
      });
    } catch (err) {
      console.error(err);
      await transaction.rollback();
      await transaction.release();
      next(err);
    }
  }
  async updateCityUser(req, res, next) {
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
          city_users
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
          city_users
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

  async getLocationAddresses(req, res, next) {
    try {
      let result = await req.db.query(`
        SELECT * 
        FROM cvms_brgy
      `);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
  async getAddresses(req, res, next) {
    try {
      let result = await req.db.query(`
        SELECT * 
        FROM cvms_addresses
        WHERE 
          isDeleted = 0
      `);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
  async searchAddress(req, res, next) {
    let { brgy, unitNo, houseNo, street, phase } = req.body;
    try {
      let qry = [];
      let param = [];
      if (!global.isEmpty(brgy)) {
        qry.push(`AND B.brgyDesc LIKE ?`);
        param.push(`${brgy}%`);
      }
      if (!global.isEmpty(unitNo)) {
        qry.push(`AND A.unitNo LIKE ?`);
        param.push(`${unitNo}`);
      }
      if (!global.isEmpty(houseNo)) {
        qry.push(`AND A.houseNo LIKE ?`);
        param.push(`${houseNo}%`);
      }
      if (!global.isEmpty(street)) {
        qry.push(`AND A.street LIKE ?`);
        param.push(`${street}%`);
      }
      if (!global.isEmpty(phase)) {
        qry.push(`AND A.phase LIKE ?`);
        param.push(`${phase}%`);
      }

      let addresses = await req.db.query(
        `
        SELECT
          A.id,
          A.addressCode,
          A.brgyId,
          A.unitNo,
          A.houseNo,
          A.street,
          A.phase, 
          B.brgyDesc,
          B.cityDesc,
          B.provinceDesc,
          B.regionId
        FROM cvms_addresses A
        LEFT JOIN cvms_brgy B ON B.brgyId = A.brgyId
        WHERE
          A.isDeleted = 0
          ${qry.join(" ")}
      `,
        param
      );

      if (addresses.length == 0) {
        return res.status(200).json(addresses);
      }

      let familyHead = await req.db.query(
        `
        SELECT 
          F.householdId,
          F.addressCode,
          F.familyType,
          F.accountId,
          F.familyRelation,
          C.firstName,
          C.middleName,
          C.lastName,
          C.suffix,
          C.birthdate,
          C.sex,
          C.familyCode
        FROM cvms_familymembers F
        LEFT JOIN citizen_info C ON C.accountId = F.accountId
        WHERE
          SUBSTR(F.familyType,3,3) = ? AND
          F.isDeleted = ? AND 
          C.isDeleted = ?
      `,
        ["A", 0, 0]
      );

      let result = addresses.map((a) => {
        let head = familyHead.filter((f) => f.addressCode === a.addressCode);
        a.familyHeads = head;

        return a;
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
  async createNewAddress(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { brgyId } = req.body;
    let val = req.body;
    try {
      val.addressCode = (
        await req.db.query(
          `SELECT fnAddressCodeGen('${brgyId}') as addressCode`
        )
      )[0].addressCode;
      val.dateCreated = date;
      val.dateUpdated = date;
      console.log(val);

      let result = await req.db.query(
        `
        INSERT INTO cvms_addresses
        SET ?
      `,
        val
      );

      if (result.insertId > 0) {
        return res.status(200).json({ message: `Inserted Successfully.` });
      } else {
        return res
          .status(500)
          .json({ error: 500, message: `Failed to insert.` });
      }
    } catch (err) {
      next(err);
    }
  }
  async updateAddresses(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { id } = req.params;
    let val = req.body;
    try {
      val.dateUpdated = date;

      let result = await req.db.query(
        `
        UPDATE cvms_addresses
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
  async getPhaseAndStreet(req, res, next) {
    try {
      let result = await req.db.query(
        `
        SELECT * 
        FROM brgy_phase_street
        WHERE 
          isDeleted = 0
      `
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
