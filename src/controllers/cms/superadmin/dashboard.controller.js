import moment from "moment";
import mtz from "moment-timezone";

export default class Controller {
  async getRegisteredCitizen(req, res, next) {
    try {
      let result = await req.db.query(`
        SELECT *
        FROM citizen_info
        WHERE isDeleted = 0
      `);
      return res.status(200).json(result.length);
    } catch (err) {
      next(err);
    }
  }

  async getVerifiedCitizen(req, res, next) {
    try {
      let result = await req.db.query(
        `
        SELECT 
          I.accountId,
          V.services,
          V.status
        FROM citizen_info I
        LEFT JOIN citizen_verifystatus V ON V.accountid = I.accountId
        WHERE
          V.services = ? AND
          I.isDeleted = 0
      `,
        ["PROFILE"]
      );
      let unverified = result.filter((v) => o.status === "APPROVED");
      let verified = result.filter((v) => v.status !== "APPROVED");
      res
        .status(200)
        .json({ unverified: unverified.length, verified: verified.length });
    } catch (err) {
      next(err);
    }
  }

  async getVerifiedQuestionaire(req, res, next) {
    try {
      let result = await req.db.query(`
        SELECT
          householdId,
          addressCode,
          familyHeadId,
          isVerified,
          isDeleted
        FROM cvms_surveyanswer
        WHERE 
          isDeleted = 0
      `);
      let unverified = result.filter((v) => o.isVerified === 1);
      let verified = result.filter((v) => v.isVerified !== 1);
      res
        .status(200)
        .json({ unverified: unverified.length, verified: verified.length });
    } catch (err) {
      next(err);
    }
  }

  async getCitizenPerBarangay(req, res, next) {
    try {
      let brgy = await req.db.query(`
      SELECT 
        COUNT(F.accountId) as citizens,
        B.brgyDesc,
        SUBSTRING_INDEX(F.addressCode, "-", 1) as brgyId
      FROM cvms_familymembers F
      LEFT JOIN cvms_brgy B ON B.brgyId = SUBSTRING_INDEX(F.addressCode, "-", 1)
      WHERE
        F.isDeleted = 0
      GROUP BY 
        SUBSTRING_INDEX(F.addressCode, "-", 1)
      `);

      return res.status(200).json(brgy);
    } catch (err) {
      next(err);
    }
  }

  async getListFamilyHead(req, res, next) {
    try {
      let result = await req.db.query(`
      SELECT 
        F.householdId,
          F.addressCode,
          F.accountId,
          I.firstName,
          I.middleName,
          I.lastName,
          I.suffix,
          I.birthdate,
          I.sex
          
      FROM cvms_familymembers F 
      LEFT JOIN citizen_info I ON I.accountId = F.accountId
      WHERE 
        substr(F.familyType,-1) = 'A' AND
          F.isDeleted = 0 AND 
          I.isDeleted = 0
      `);

      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
  async getListUsers(req, res, next) {
    try {
      let result = await req.db.query(`
      SELECT 
        I.accountId,
        I.firstName,
        I.middleName,
        I.lastName,
        I.suffix,
        I.birthdate,
        I.sex,
        (SELECT status FROM citizen_verifystatus WHERE services = "PROFILE" AND accountId = I.accountId ) as isVerified
      FROM citizen_info I
      WHERE
        I.isDeleted = 0
      `);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getVerifiedCitizensPerSector(req, res, next) {
    try {
      let sectors = await req.db.query(
        `
        SELECT
          S.id,
          S.name,
          CS.count
        FROM
          cms_sectors S
        LEFT JOIN (
          SELECT
            COUNT(CS.accountId) AS count,
            S.id
		      FROM
			      cms_sectors S
		      LEFT JOIN
			      citizen_sectors CS
			      ON CS.sectorId =  S.id
          GROUP BY S.id
          ) AS CS 
          ON CS.id = S.id
         WHERE
          S.isDeleted = 0
      `
      );
      return res.status(200).json(sectors);
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async getVerifiedCitizensPerAge(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD");
    try {
      let age = await req.db.query(
        `
        SELECT
          DATE_FORMAT(FROM_DAYS(DATEDIFF(?, C.birthdate)), '%Y') + 0 AS age,
		      COUNT(DATE_FORMAT(FROM_DAYS(DATEDIFF(?, C.birthdate)), '%Y') + 0) AS count
        FROM
          citizen_info C
        LEFT JOIN
          citizen_verifystatus CV
          USING(accountId) 
        WHERE
          CV.status= "APPROVED" AND 
          C.isDeleted = 0
		    GROUP BY age
      `,
        [date, date]
      );
      return res.status(200).json(age);
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async getVerifiedCount(req, res, next) {
    try {
      let count = await req.db.query(
        `
        SELECT
          COUNT(*) AS count
        FROM
          citizen_info C
        LEFT JOIN
          citizen_verifystatus CV
          USING(accountId) 
        WHERE
          CV.status= "APPROVED" AND 
          C.isDeleted = 0
      `
      );

      return res.status(200).json(count[0].count);
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async getUnverifiedCount(req, res, next) {
    try {
      let count = await req.db.query(
        `
        SELECT
          COUNT(*) as count
        FROM
          citizen_info C
        LEFT JOIN
          citizen_verifystatus CV
          USING(accountId) 
        WHERE
          CV.status= "PENDING" AND
          C.isDeleted = 0
      `
      );

      return res.status(200).json(count[0].count);
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async getProgramsCount(req, res, next) {
    const { dateFrom, dateTo } = req.body;
    try {
      let dateValidation = "";
      let validationParams = [];
      if (dateFrom == dateTo) {
        dateValidation = "DATEDIFF(dateCreated, ?) = 0";
        validationParams.push(dateFrom);
      } else {
        dateValidation = "dateCreated BETWEEN ? AND ?";
        validationParams.push(dateFrom);
        validationParams.push(dateTo);
      }
      let count = await req.db.query(
        `
        SELECT
          COUNT(*) AS count,
          PROG.type
        FROM
          citizen_info C
        LEFT JOIN(
          SELECT 
            type,
            accountId,
            id, 
            dateCreated
          FROM (
            SELECT
              CER.certificationType AS type,
              CER.accountId,
              CER.certificationId AS id,
              CER.dateCreated
            FROM
              brgy_certification CER
            UNION
            SELECT
              "Cedula" AS type,
              CED.accountId,
              CED.cedulaId AS id,
              CED.dateCreated
            FROM
              brgy_cedula CED
            UNION
            SELECT
              clearanceType AS type,
              CLE.accountId,
              CLE.clearanceId AS id,
              CLE.dateCreated
            FROM
              brgy_clearance CLE
            UNION
            SELECT
              "Barangay ID" AS type,
              BI.accountId,
              BI.idNumber AS id,
              BI.dateCreated
            FROM
              brgy_id BI
            
          ) ASD
          WHERE ${dateValidation}
        ) PROG USING(accountId)
        LEFT JOIN
          citizen_verifystatus CV
          USING(accountId) 
        WHERE
          CV.status= "APPROVED" AND 
          C.isDeleted = 0 AND
          PROG.type IS NOT NULL
        GROUP BY PROG.type
      `,
        validationParams
      );

      return res.status(200).json(count);
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async getOngoingEvents(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    try {
      let events = await req.db.query(
        `
        SELECT *
        FROM brgy_events
        WHERE
          dateFrom < ? AND
          dateTo > ?
      `,
        [date, date]
      );
      return res.status(200).json(events);
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async getScheduledEvents(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    try {
      let events = await req.db.query(
        `
        SELECT *
        FROM brgy_events
        WHERE
          dateFrom > ?
      `,
        [date]
      );
      return res.status(200).json(events);
    } catch (err) {
      console.error(err);
      next(err);
    }
  }
}
