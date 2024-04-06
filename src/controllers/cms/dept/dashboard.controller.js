import moment from "moment";
import mtz from "moment-timezone";
import hash from "#helpers/hash";

export default class Controller {
  async getCountsPerBrgy(req, res, next) {
    const { cityId, brgyId, accountType, type } = req.currentUser;
    if (accountType === "department") {
      try {
        let count;

        if (type === 4) {
          count = await req.db.query(
            `
              SELECT 
                B.brgyDesc,
                B.brgyCode as brgyId,
                COUNT(CASE WHEN C.status = 'APPROVED' THEN 1 END) AS verified,
                COUNT(CASE WHEN C.status = 'PENDING' THEN 1 END) AS unverified
              FROM brgy B
              LEFT JOIN (
                SELECT 
                  A.accountId,
                  A.cityId,
                  A.brgyId,
                  COUNT(A.accountId) as total,
                  A.typee,
                  CI.birthdate,
                  CV.status
                FROM (
                  SELECT 
                    FM.accountId,
                    CA.cityId,
                    CA.brgyId,
                    "cvms" as typee
                  FROM cvms_familymembers FM
                  JOIN cvms_addresses CA ON CA.addressCode = FM.addressCode
                  WHERE
                    FM.isDeleted = 0
                  UNION ALL
                  SELECT 
                    accountId,
                    cityId,
                    brgyId,
                    "reglogs" as typee
                  FROM registration_logs
                  WHERE
                    brgyId is not null
                ) A 
                LEFT JOIN citizen_info CI ON CI.accountId = A.accountId
                JOIN citizen_verifystatus CV ON CV.accountId = CI.accountId
                WHERE
                  CI.isDeleted = 0 AND
                  CI.birthdate <= DATE_SUB(SUBSTR(CONVERT_TZ(NOW(), 'SYSTEM', '+08:00'),1,10), INTERVAL 60 YEAR)
                GROUP BY
                  A.accountId
              ) C ON C.brgyId = B.brgyCode
              WHERE 
                B.cityCode = ?
              GROUP BY B.brgyCode
            `,
            [cityId]
          );
        } else {
          count = await req.db.query(
            `
              SELECT 
                B.brgyDesc,
                B.brgyCode as brgyId,
                COUNT(CASE WHEN C.status = 'APPROVED' THEN 1 END) AS verified,
                COUNT(CASE WHEN C.status = 'PENDING' THEN 1 END) AS unverified
              FROM brgy B
              LEFT JOIN (
                SELECT 
                  A.accountId,
                  A.cityId,
                  A.brgyId,
                  COUNT(A.accountId) as total,
                  A.typee,
                  CI.birthdate,
                  CV.status
                FROM (
                  SELECT 
                    FM.accountId,
                    CA.cityId,
                    CA.brgyId,
                    "cvms" as typee
                  FROM cvms_familymembers FM
                  JOIN cvms_addresses CA ON CA.addressCode = FM.addressCode
                  WHERE
                    FM.isDeleted = 0
                  UNION ALL
                  SELECT 
                    accountId,
                    cityId,
                    brgyId,
                    "reglogs" as typee
                  FROM registration_logs
                  WHERE
                    brgyId is not null
                ) A 
                LEFT JOIN citizen_info CI ON CI.accountId = A.accountId
                LEFT JOIN citizen_sectors CS ON CS.accountId = CI.accountId
                JOIN citizen_verifystatus CV ON CV.accountId = CI.accountId
                WHERE
                  CI.isDeleted = 0 AND
                  CS.sectorId = ?
                GROUP BY
                  A.accountId
              ) C ON C.brgyId = B.brgyCode
              WHERE 
                B.cityCode = ?
              GROUP BY B.brgyCode
            `,
            [type, cityId]
          );
        }

        return res.status(200).json(count);
      } catch (err) {
        console.error(err);
        next(err);
      }
    } else {
      try {
        let count = await req.db.query(
          `
            SELECT 
              B.brgyDesc,
              B.brgyCode as brgyId,
              COUNT(CASE WHEN C.status = 'APPROVED' THEN 1 END) AS verified,
              COUNT(CASE WHEN C.status = 'PENDING' THEN 1 END) AS unverified
            FROM brgy B
            LEFT JOIN (
              SELECT 
                A.accountId,
                A.cityId,
                A.brgyId,
                COUNT(A.accountId) as total,
                A.typee,
                CI.birthdate,
                CV.status
              FROM (
                SELECT 
                  FM.accountId,
                  CA.cityId,
                  CA.brgyId,
                  "cvms" as typee
                FROM cvms_familymembers FM
                JOIN cvms_addresses CA ON CA.addressCode = FM.addressCode
                WHERE
                  FM.isDeleted = 0
                UNION ALL
                SELECT 
                  accountId,
                  cityId,
                  brgyId,
                  "reglogs" as typee
                FROM registration_logs
                WHERE
                  brgyId is not null
              ) A 
              LEFT JOIN citizen_info CI ON CI.accountId = A.accountId
              JOIN citizen_verifystatus CV ON CV.accountId = CI.accountId
              WHERE
                CI.isDeleted = 0 AND
                CI.birthdate <= DATE_SUB(SUBSTR(CONVERT_TZ(NOW(), 'SYSTEM', '+08:00'),1,10), INTERVAL 60 YEAR)
              GROUP BY
                A.accountId
            ) C ON C.brgyId = B.brgyCode
            WHERE 
              B.cityCode = ?
            GROUP BY B.brgyCode
        `,
          cityId
        );

        return res.status(200).json(count);
      } catch (err) {
        console.error(err);
        next(err);
      }
    }
  }

  async getSectorRecord(req, res, next) {
    try {
      let sectorCount = await req.db.query(`
        SELECT 
          S.name as sectorName,
          COUNT(CS.sectorId) as total
        FROM cms_sectors S
        LEFT JOIN citizen_sectors CS ON S.id = CS.sectorId
        WHERE
          CS.isDeleted = 0
        GROUP BY CS.sectorId
      `);

      let citizenRecord = await req.db.query(`
        SELECT
          accountId,
          firstName,
          middleName,
          lastName,
          suffix,
          birthdate,
          sex
        FROM citizen_info
        WHERE 
          isDeleted = 0
      `);
      let sectorPerCitizen = await req.db.query(`
        SELECT 
          S.accountId,
          S.sectorId,
          CS.name
        FROM citizen_sectors S
        LEFT JOIN cms_sectors CS ON S.sectorId = CS.id
        WHERE
          S.isDeleted = 0
      `);
      let sector = sectorPerCitizen.map((c) => {
        let citizen = citizenRecord.filter((s) => s.accountId === c.accountId);

        c.citizen = citizen;
        return c;
      });
      return res.status(200).json({
        chart: sectorCount,
        record: sector,
      });
    } catch (err) {
      next(err);
    }
  }

  async getEventRecords(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    try {
      let result = await req.db.query(`
        SELECT *
        FROM brgy_events
      `);

      let attendees = await req.db.query(`
        SELECT 
          EA.attendeeId,
          EA.eventId,
          EA.citizenId,
          EA.raffleClaimed,
          EA.kitGiven,
          EA.foodGiven,
          CI.accountId,
          CI.firstName,
          CI.middleName,
          CI.lastName,
          CI.suffix,
          CI.birthdate,
          CI.sex
        FROM brgy_events_attendees EA
        LEFT JOIN citizen_info CI ON CI.accountId = EA.citizenId
      `);
      let sectorPerCitizen = await req.db.query(`
        SELECT 
          S.accountId,
          S.sectorId,
          CS.name
        FROM citizen_sectors S
        LEFT JOIN cms_sectors CS ON S.sectorId = CS.id
        WHERE
          S.isDeleted = 0
      `);

      let citizen = attendees.map((c) => {
        let sect = sectorPerCitizen.filter((s) => (s.accountId = c.citizenId));
        c.sector = sect;
        return c;
      });
      let events = result.map((e) => {
        let attendee = citizen.filter((c) => c.eventId === e.eventId);
        e.attendees = attendee;
        return e;
      });
      return res.status(200).json(events);
    } catch (err) {
      next(err);
    }
  }

  async getVerifiedCitizensPerSector(req, res, next) {
    const { cityId } = req.currentUser;
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
          LEFT JOIN
            registration_logs RL
            USING(accountId)
          LEFT JOIN(
            SELECT 
              CF.addressCode,
              CA.brgyId,
              CF.accountId,
              BR.cityCode AS cityId
            FROM 
              cvms_familymembers CF
            LEFT JOIN
              cvms_addresses CA 
              USING(addressCode)
            LEFT JOIN
              brgy BR
              ON BR.brgyCode = CA.brgyId
            WHERE
              CF.isDeleted= 0
            ORDER BY CF.dateCreated DESC
          ) AD USING(accountId)
          WHERE
            (RL.cityId= ? OR AD.cityId= ? )
          GROUP BY S.id
          ) AS CS 
          ON CS.id = S.id
         WHERE
          S.isDeleted = 0
      `,
        [cityId, cityId]
      );
      return res.status(200).json(sectors);
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async getVerifiedCitizensPerAge(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD");
    const { cityId, brgyId, accountType, type } = req.currentUser;

    if (accountType === "department") {
      if (type === 4) {
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
          LEFT JOIN
            registration_logs RL
            USING(accountId)
          LEFT JOIN(
            SELECT 
              CF.addressCode,
              CA.brgyId,
              CF.accountId,
              BR.cityCode AS cityId
            FROM 
              cvms_familymembers CF
            LEFT JOIN
              cvms_addresses CA 
              USING(addressCode)
            LEFT JOIN
              brgy BR
              ON BR.brgyCode = CA.brgyId
            WHERE
              CF.isDeleted= 0
            ORDER BY CF.dateCreated DESC
          ) AD USING(accountId)
          WHERE
            CV.status= "APPROVED" AND 
            (RL.cityId= ? OR AD.cityId= ?) AND
            C.isDeleted = 0 AND
            C.birthdate <= DATE_SUB(SUBSTR(CONVERT_TZ(NOW(), 'SYSTEM', '+08:00'),1,10), INTERVAL 60 YEAR)
          GROUP BY age
        `,
            [date, date, cityId, cityId]
          );
          return res.status(200).json(age);
        } catch (err) {
          console.error(err);
          next(err);
        }
      } else {
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
          LEFT JOIN
            citizen_sectors CS
            USING(accountId)
          LEFT JOIN
            registration_logs RL
            USING(accountId)
          LEFT JOIN(
            SELECT 
              CF.addressCode,
              CA.brgyId,
              CF.accountId,
              BR.cityCode AS cityId
            FROM 
              cvms_familymembers CF
            LEFT JOIN
              cvms_addresses CA 
              USING(addressCode)
            LEFT JOIN
              brgy BR
              ON BR.brgyCode = CA.brgyId
            WHERE
              CF.isDeleted= 0
            ORDER BY CF.dateCreated DESC
          ) AD USING(accountId)
          WHERE
            CV.status= "APPROVED" AND 
            (RL.cityId= ? OR AD.cityId= ?) AND
            C.isDeleted = 0 AND
            CS.sectorId = ?
          GROUP BY age
        `,
            [date, date, cityId, cityId, type]
          );
          return res.status(200).json(age);
        } catch (err) {
          console.error(err);
          next(err);
        }
      }
    } else {
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
        LEFT JOIN
          registration_logs RL
          USING(accountId)
        LEFT JOIN(
          SELECT 
            CF.addressCode,
            CA.brgyId,
            CF.accountId,
            BR.cityCode AS cityId
          FROM 
            cvms_familymembers CF
          LEFT JOIN
            cvms_addresses CA 
            USING(addressCode)
          LEFT JOIN
            brgy BR
            ON BR.brgyCode = CA.brgyId
          WHERE
            CF.isDeleted= 0
          ORDER BY CF.dateCreated DESC
        ) AD USING(accountId)
        WHERE
          CV.status= "APPROVED" AND 
          (RL.cityId= ? OR AD.cityId= ?) AND
          C.isDeleted = 0
		    GROUP BY age
      `,
          [date, date, cityId, cityId]
        );
        return res.status(200).json(age);
      } catch (err) {
        console.error(err);
        next(err);
      }
    }
  }

  async getVerifiedCount(req, res, next) {
    const { cityId, brgyId, accountType, type } = req.currentUser;
    if (accountType === "department") {
      try {
        let count;

        if (type === 4) {
          count = await req.db.query(
            `
            SELECT
              COUNT(*) AS count
            FROM
              citizen_info C
            LEFT JOIN
              citizen_verifystatus CV
              USING(accountId) 
            LEFT JOIN
              registration_logs RL
              USING(accountId)
            LEFT JOIN(
              SELECT 
                CF.addressCode,
                CA.brgyId,
                CF.accountId,
                BR.cityCode AS cityId
              FROM 
                cvms_familymembers CF
              LEFT JOIN
                cvms_addresses CA 
                USING(addressCode)
              LEFT JOIN
                brgy BR
                ON BR.brgyCode = CA.brgyId
              WHERE
                CF.isDeleted= 0
              ORDER BY CF.dateCreated DESC
            ) AD USING(accountId)
            WHERE
              CV.status= "APPROVED" AND 
              (RL.cityId= ? OR AD.cityId= ?) AND
              C.isDeleted = 0 AND
              C.birthdate <= DATE_SUB(SUBSTR(CONVERT_TZ(NOW(), 'SYSTEM', '+08:00'),1,10), INTERVAL 60 YEAR)
          `,
            [cityId, cityId]
          );
        } else {
          count = await req.db.query(
            `
            SELECT
              COUNT(*) AS count
            FROM
              citizen_info C
            LEFT JOIN citizen_sectors CS USING(accountId)
            LEFT JOIN
              citizen_verifystatus CV
              USING(accountId) 
            LEFT JOIN
              registration_logs RL
              USING(accountId)
            LEFT JOIN(
              SELECT 
                CF.addressCode,
                CA.brgyId,
                CF.accountId,
                BR.cityCode AS cityId
              FROM 
                cvms_familymembers CF
              LEFT JOIN
                cvms_addresses CA 
                USING(addressCode)
              LEFT JOIN
                brgy BR
                ON BR.brgyCode = CA.brgyId
              WHERE
                CF.isDeleted= 0
              ORDER BY CF.dateCreated DESC
            ) AD USING(accountId)
            WHERE
              CV.status= "APPROVED" AND 
              (RL.cityId= ? OR AD.cityId= ?) AND
              C.isDeleted = 0 AND
              CS.sectorId = ?
          `,
            [cityId, cityId, type]
          );
        }

        return res.status(200).json(count[0].count);
      } catch (err) {
        console.error(err);
        next(err);
      }
    } else {
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
          LEFT JOIN
            registration_logs RL
            USING(accountId)
          LEFT JOIN(
            SELECT 
              CF.addressCode,
              CA.brgyId,
              CF.accountId,
              BR.cityCode AS cityId
            FROM 
              cvms_familymembers CF
            LEFT JOIN
              cvms_addresses CA 
              USING(addressCode)
            LEFT JOIN
              brgy BR
              ON BR.brgyCode = CA.brgyId
            WHERE
              CF.isDeleted= 0
            ORDER BY CF.dateCreated DESC
          ) AD USING(accountId)
          WHERE
            CV.status= "APPROVED" AND 
            (RL.cityId= ? OR AD.cityId= ?) AND
            C.isDeleted = 0
        `,
          [cityId, cityId]
        );

        return res.status(200).json(count[0].count);
      } catch (err) {
        console.error(err);
        next(err);
      }
    }
  }

  async getUnverifiedCount(req, res, next) {
    const { cityId, brgyId, accountType, type } = req.currentUser;
    if (accountType === "department") {
      try {
        let count;

        if (type === 4) {
          count = await req.db.query(
            `
            SELECT
              COUNT(*) AS count
            FROM
              citizen_info C
            LEFT JOIN
              citizen_verifystatus CV
              USING(accountId) 
            LEFT JOIN
              registration_logs RL
              USING(accountId)
            LEFT JOIN(
              SELECT 
                CF.addressCode,
                CA.brgyId,
                CF.accountId,
                BR.cityCode AS cityId
              FROM 
                cvms_familymembers CF
              LEFT JOIN
                cvms_addresses CA 
                USING(addressCode)
              LEFT JOIN
                brgy BR
                ON BR.brgyCode = CA.brgyId
              WHERE
                CF.isDeleted= 0
              ORDER BY CF.dateCreated DESC
            ) AD USING(accountId)
            WHERE
              CV.status= "PENDING" AND 
              (RL.cityId= ? OR AD.cityId= ?) AND
              C.isDeleted = 0 AND
              C.birthdate <= DATE_SUB(SUBSTR(CONVERT_TZ(NOW(), 'SYSTEM', '+08:00'),1,10), INTERVAL 60 YEAR)
          `,
            [cityId, cityId]
          );
        } else {
          count = await req.db.query(
            `
            SELECT
              COUNT(*) AS count
            FROM
              citizen_info C
            LEFT JOIN
              citizen_verifystatus CV
              USING(accountId) 
            LEFT JOIN
              registration_logs RL
              USING(accountId)
            LEFT JOIN
              citizen_sectors CS
              USING(accountId)
            LEFT JOIN(
              SELECT 
                CF.addressCode,
                CA.brgyId,
                CF.accountId,
                BR.cityCode AS cityId
              FROM 
                cvms_familymembers CF
              LEFT JOIN
                cvms_addresses CA 
                USING(addressCode)
              LEFT JOIN
                brgy BR
                ON BR.brgyCode = CA.brgyId
              WHERE
                CF.isDeleted= 0
              ORDER BY CF.dateCreated DESC
            ) AD USING(accountId)
            WHERE
              CV.status= "PENDING" AND 
              (RL.cityId= ? OR AD.cityId= ?) AND
              C.isDeleted = 0 AND
              CS.sectorId = ?
          `,
            [cityId, cityId, type]
          );
        }

        return res.status(200).json(count[0].count);
      } catch (err) {
        console.error(err);
        next(err);
      }
    } else {
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
          LEFT JOIN
            registration_logs RL
            USING(accountId)
          LEFT JOIN(
            SELECT 
              CF.addressCode,
              CA.brgyId,
              CF.accountId,
              BR.cityCode AS cityId
            FROM 
              cvms_familymembers CF
            LEFT JOIN
              cvms_addresses CA 
              USING(addressCode)
            LEFT JOIN
              brgy BR
              ON BR.brgyCode = CA.brgyId
            WHERE
              CF.isDeleted= 0
            ORDER BY CF.dateCreated DESC
          ) AD USING(accountId)
          WHERE
            CV.status= "PENDING" AND 
            (RL.cityId= ? OR AD.cityId= ?) AND
            C.isDeleted = 0
        `,
          [cityId, cityId]
        );

        return res.status(200).json(count[0].count);
      } catch (err) {
        console.error(err);
        next(err);
      }
    }
  }

  async getProgramsCount(req, res, next) {
    const { dateFrom, dateTo } = req.body;
    const { cityId, brgyId, accountType, type } = req.currentUser;

    if (accountType === "department") {
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

        let count;

        if (type === 4) {
          count = await req.db.query(
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
            LEFT JOIN
              registration_logs RL
              USING(accountId)
            LEFT JOIN(
              SELECT 
                CF.addressCode,
                CA.brgyId,
                CF.accountId,
                BR.cityCode AS cityId
              FROM 
                cvms_familymembers CF
              LEFT JOIN
                cvms_addresses CA 
                USING(addressCode)
              LEFT JOIN
                brgy BR
                ON BR.brgyCode = CA.brgyId
              WHERE
                CF.isDeleted= 0
              ORDER BY CF.dateCreated DESC
            ) AD USING(accountId)
            WHERE
              CV.status= "APPROVED" AND 
              (RL.cityId= ? OR AD.cityId= ?) AND
              C.isDeleted = 0 AND
              PROG.type IS NOT NULL AND
              C.birthdate <= DATE_SUB(SUBSTR(CONVERT_TZ(NOW(), 'SYSTEM', '+08:00'),1,10), INTERVAL 60 YEAR)
            GROUP BY PROG.type
          `,
            [...validationParams, cityId, cityId]
          );
        } else {
          count = await req.db.query(
            `
            SELECT
              COUNT(*) AS count,
              PROG.type
            FROM
              citizen_info C
            LEFT JOIN citizen_sectors CS USING(accountId)
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
            LEFT JOIN
              registration_logs RL
              USING(accountId)
            LEFT JOIN(
              SELECT 
                CF.addressCode,
                CA.brgyId,
                CF.accountId,
                BR.cityCode AS cityId
              FROM 
                cvms_familymembers CF
              LEFT JOIN
                cvms_addresses CA 
                USING(addressCode)
              LEFT JOIN
                brgy BR
                ON BR.brgyCode = CA.brgyId
              WHERE
                CF.isDeleted= 0
              ORDER BY CF.dateCreated DESC
            ) AD USING(accountId)
            WHERE
              CV.status= "APPROVED" AND 
              (RL.cityId= ? OR AD.cityId= ?) AND
              C.isDeleted = 0 AND
              PROG.type IS NOT NULL AND
              CS.sectorId = ?
            GROUP BY PROG.type
          `,
            [...validationParams, cityId, cityId, type]
          );
        }

        return res.status(200).json(count);
      } catch (err) {
        console.error(err);
        next(err);
      }
    } else {
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
          LEFT JOIN
            registration_logs RL
            USING(accountId)
          LEFT JOIN(
            SELECT 
              CF.addressCode,
              CA.brgyId,
              CF.accountId,
              BR.cityCode AS cityId
            FROM 
              cvms_familymembers CF
            LEFT JOIN
              cvms_addresses CA 
              USING(addressCode)
            LEFT JOIN
              brgy BR
              ON BR.brgyCode = CA.brgyId
            WHERE
              CF.isDeleted= 0
            ORDER BY CF.dateCreated DESC
          ) AD USING(accountId)
          WHERE
            CV.status= "APPROVED" AND 
            (RL.cityId= ? OR AD.cityId= ?) AND
            C.isDeleted = 0 AND
            PROG.type IS NOT NULL
          GROUP BY PROG.type
        `,
          [...validationParams, cityId, cityId]
        );

        return res.status(200).json(count);
      } catch (err) {
        console.error(err);
        next(err);
      }
    }
  }

  async getOngoingEvents(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    const { cityId, brgyId, accountType, type } = req.currentUser;

    if (accountType === "department") {
      try {
        let events;
        if (type === 4) {
          events = await req.db.query(
            `
            SELECT 
              BE.*
            FROM brgy_events BE
            LEFT JOIN brgy B ON B.brgyCode = BE.brgyId
            WHERE
              BE.dateFrom < ? AND
              BE.dateTo > ? AND
              B.cityCode = ? AND
              BE.eventType IN (1, 2)
          `,
            [date, date, cityId]
          );
        } else {
          events = await req.db.query(
            `
            SELECT 
              BE.*
            FROM brgy_events BE
            LEFT JOIN brgy B ON B.brgyCode = BE.brgyId
            WHERE
              BE.dateFrom < ? AND
              BE.dateTo > ? AND
              B.cityCode = ? AND
              BE.eventType IN (1, ?)
          `,
            [date, date, cityId, type]
          );
        }
        return res.status(200).json(events);
      } catch (err) {
        console.error(err);
        next(err);
      }
    } else {
      try {
        let events = await req.db.query(
          `
          SELECT *
          FROM brgy_events
          WHERE
            dateFrom < ? AND
            dateTo > ? AND
            B.cityCode = ? AND
            BE.eventType IN (1, 2)
        `,
          [date, date, cityId]
        );
        return res.status(200).json(events);
      } catch (err) {
        console.error(err);
        next(err);
      }
    }
  }

  async getScheduledEvents(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    const { cityId, brgyId, accountType, type } = req.currentUser;
    if (accountType === "department") {
      try {
        let events;
        if (type === 4) {
          events = await req.db.query(
            `
            SELECT 
              BE.*
            FROM brgy_events BE
            LEFT JOIN brgy B ON B.brgyCode = BE.brgyId
            WHERE
              BE.dateFrom < ? AND
              B.cityCode = ? AND
              BE.eventType IN (1, 2)
          `,
            [date, date, cityId]
          );
        } else {
          events = await req.db.query(
            `
            SELECT 
              BE.*
            FROM brgy_events BE
            LEFT JOIN brgy B ON B.brgyCode = BE.brgyId
            WHERE
              BE.dateFrom < ? AND
              B.cityCode = ? AND
              BE.eventType IN (1, ?)
          `,
            [date, date, cityId, type]
          );
        }
        return res.status(200).json(events);
      } catch (err) {
        console.error(err);
        next(err);
      }
    } else {
      try {
        let events = await req.db.query(
          `
          SELECT *
          FROM brgy_events
          WHERE
            dateFrom < ? AND
            B.cityCode = ? AND
            BE.eventType IN (1, 2)
        `,
          [date, date, cityId]
        );
        return res.status(200).json(events);
      } catch (err) {
        console.error(err);
        next(err);
      }
    }
  }
}
