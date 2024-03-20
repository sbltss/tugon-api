import mtz from "moment-timezone";
import global from "#helpers/global";

export default class Controller {
  async accountLists(req, res, next) {
    try {
      let result = await req.db.query(`
      SELECT 
        accountId,
        name,
        module,
        position,
        lguId,
        username,
        email,
        dateUpdated,
        dateCreated,
        isDeleted
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
      val.password = "Dynamic2014";

      let result = await req.db.query(
        `
        INSERT INTO cms_accounts
        SET ?
      `,
        val
      );
      if (result.insertId > 0) {
        const updatedAccount = await req.db.query(
          `
          SELECT 
            accountId,
            name,
            module,
            position,
            lguId,
            username,
            email,
            dateUpdated,
            dateCreated,
            isDeleted
          FROM
            cms_accounts
          WHERE
            accountId = ?
        `,
          result.insertId
        );
        return res
          .status(200)
          .json({ message: `Sucessfully inserted.`, data: updatedAccount[0] });
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
    let { accountId } = req.params;
    try {
      val.dateUpdated = date;
      let result = await req.db.query(
        `
        UPDATE cms_accounts
        SET ?
        WHERE
          accountId = ?
      `,
        [val, accountId]
      );
      if (result.affectedRows > 0) {
        const updatedAccount = await req.db.query(
          `
          SELECT 
            accountId,
            name,
            module,
            position,
            lguId,
            username,
            email,
            dateUpdated,
            dateCreated,
            isDeleted
          FROM
            cms_accounts
          WHERE
            accountId = ?
        `,
          accountId
        );
        return res
          .status(200)
          .json({ message: `Sucessfully updated.`, data: updatedAccount[0] });
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
    let { accountId } = req.params;
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
        [val, accountId]
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
  async searchCitizen(req, res, next) {
    const { accountId, firstName, middleName, lastName, mobileNumber } =
      req.body;
    try {
      let ucon = [];
      let uparam = [];

      if (!global.isEmpty(accountId)) {
        ucon.push(`AND accountId = ?`);
        uparam.push(accountId);
      }
      if (!global.isEmpty(firstName)) {
        ucon.push(`AND firstName LIKE ?`);
        uparam.push(`${firstName}%`);
      }
      if (!global.isEmpty(middleName)) {
        ucon.push(`AND middleName LIKE ?`);
        uparam.push(`${middleName}%`);
      }
      if (!global.isEmpty(lastName)) {
        ucon.push(`AND lastName LIKE ?`);
        uparam.push(`${lastName}%`);
      }
      if (!global.isEmpty(mobileNumber)) {
        ucon.push(`AND CC.tempMobile LIKE ?`);
        uparam.push(`${lastName}%`);
      }
      let citizenInfo = await req.db.query(
        `
        SELECT 
            C.*,
            CR.username,
            CC.primaryEmail,
            CC.primaryMobile
          FROM 
            citizen_info C
        LEFT JOIN 
          citizen_contacts CC USING(accountId)
        LEFT JOIN
          citizen_credential CR
          USING(accountId)
        LEFT JOIN
          citizen_verifystatus CV
          USING(accountId)
        WHERE
          C.isDeleted = 0
          ${ucon.join(" ")}
      `,
        uparam
      );
      let citizenStatus = await req.db.query(
        `
        SELECT *
        FROM citizen_verifystatus
        WHERE 
          services IN ("PROFILE","CVMS")
      `
      );
      let citizenFiles = await req.db.query(
        `
        SELECT *
        FROM 
          citizen_files
        WHERE
          module = ? AND 
          isDeleted = ?
      `,
        ["PROFILE", 0]
      );

      let address = await req.db.query(`
        SELECT 
          F.householdId,
          F.addressCode,
          F.accountId,
          F.familyType,
          F.familyRelation,
          A.unitNo,
          A.houseNo,
          A.street,
          A.phase,
          B.brgyId,
          B.brgyDesc,
          B.cityDesc,
          B.provinceDesc,
          B.regionDesc
        FROM cvms_familymembers F
        LEFT JOIN cvms_addresses A ON A.addressCode = F.addressCode
        LEFT JOIN cvms_brgy B ON B.brgyId = A.brgyId
      `);
      let sectors = await req.db.query(`
        SELECT
          S.accountId,
          S.sectorId,
          C.name,
          C.requirements
        FROM citizen_sectors S
        LEFT JOIN cms_sectors C ON C.id = S.sectorId
        WHERE
          S.isDeleted = 0
      `);
      let result = citizenInfo.map((i) => {
        let status = citizenStatus.filter((s) => s.accountId === i.accountId);
        let files = citizenFiles.filter((f) => f.accountId === i.accountId);
        let adds = address.filter((a) => a.accountId === i.accountId);
        let sect = sectors.filter((s) => s.accountId === i.accountId);

        i.status = status[0].status;
        i.files = files;
        i.address = adds;
        i.sectors = sect;
        return i;
      });

      return res.status(200).json(result);
    } catch (err) {
      console.error(err);
      next(err);
    }
  }
}
