import moment from "moment";
import mtz from "moment-timezone";
import hash from "#helpers/hash";

export default class Controller {
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
    const { brgyId } = req.currentUser;

    try {
      let ageGroups = await req.db.query(
        `
      SELECT
        ageGroup,
        COUNT(*) AS count,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'accountId', accountId,
            'firstName', firstName,
            'middleName', middleName,
            'lastName', lastName,
            'birthdate', birthDate
          )
        ) AS citizensData
      FROM (
        SELECT
          CASE
            WHEN age BETWEEN 0 AND 4 THEN '0-4'
            WHEN age BETWEEN 5 AND 11 THEN '5-11'
            WHEN age BETWEEN 12 AND 17 THEN '12-17'
            WHEN age BETWEEN 18 AND 59 THEN '18-59'
            ELSE '60-above'
          END AS ageGroup,
          accountId,
          firstName,
          middleName,
          lastName,
          birthDate
        FROM (
          SELECT
            DATE_FORMAT(FROM_DAYS(DATEDIFF(?, C.birthdate)), '%Y') + 0 AS age,
            C.accountId,
            C.firstName,
            C.middleName,
            C.lastName,
            C.birthDate
          FROM
            citizen_info C
          LEFT JOIN
            citizen_verifystatus CV
            USING(accountId) 
          LEFT JOIN
            registration_logs RL
            USING(accountId)
          LEFT JOIN (
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
              CF.isDeleted = 0
            ORDER BY CF.dateCreated DESC
          ) AD USING(accountId)
          WHERE
            CV.status = "APPROVED" AND 
            (RL.brgyId = ? OR AD.brgyId = ?) AND
            C.isDeleted = 0
        ) AS ageData
        GROUP BY ageGroup, accountId, firstName, middleName, lastName, birthDate
      ) AS groupedData
      GROUP BY ageGroup
      `,
        [date, brgyId, brgyId]
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

      let result = ageGroups.map((group) => {
        let citizens = group.citizensData.map((citizen) => {
          let citizenAddress = address.filter(
            (a) => a.accountId === citizen.accountId
          );
          citizen.address = citizenAddress;
          return citizen;
        });
        return {
          ageGroup: group.ageGroup,
          count: group.count,
          citizensData: citizens,
        };
      });

      return res.status(200).json(result);
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async getVerifiedCount(req, res, next) {
    const { brgyId } = req.currentUser;
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
          (RL.brgyId= ? OR AD.brgyId= ?) AND
          C.isDeleted = 0
      `,
        [brgyId, brgyId]
      );

      return res.status(200).json(count[0].count);
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async getUnverifiedCount(req, res, next) {
    const { brgyId } = req.currentUser;
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
        LEFT JOIN
          registration_logs RL
          USING(accountId)
        WHERE
          CV.status= "PENDING" AND
          RL.brgyId= ? AND
          C.isDeleted = 0
      `,
        [brgyId]
      );

      return res.status(200).json(count[0].count);
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async getProgramsCount(req, res, next) {
    const { dateFrom, dateTo } = req.body;
    const { brgyId } = req.currentUser;
    try {
      let dateValidation = "";
      let validationParams = [];
      if (dateFrom == dateTo) {
        dateValidation = "DATEDIFF(dateCreated, ?) = 0";
        validationParams.push(dateFrom);
      } else {
        dateValidation = "SUBSTR(dateCreated, 1, 10) BETWEEN ? AND ?";
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
          (AD.brgyId = ? OR RL.brgyId = ?) AND
          C.isDeleted = 0 AND
          PROG.type IS NOT NULL
        GROUP BY PROG.type
      `,
        [...validationParams, brgyId, brgyId]
      );

      return res.status(200).json(count);
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async getOngoingEvents(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    const { brgyId } = req.currentUser;
    try {
      let events = await req.db.query(
        `
        SELECT *
        FROM brgy_events
        WHERE
          dateFrom < ? AND
          dateTo > ? AND
          brgyId= ?
      `,
        [date, date, brgyId]
      );
      return res.status(200).json(events);
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async getScheduledEvents(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    const { brgyId } = req.currentUser;
    try {
      let events = await req.db.query(
        `
        SELECT *
        FROM brgy_events
        WHERE
          dateFrom > ? AND
          brgyId= ?
      `,
        [date, brgyId]
      );
      return res.status(200).json(events);
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async getCountsPerBrgy(req, res, next) {
    const { cityId, brgyId } = req.currentUser;
    console.log(brgyId);
    try {
      const brgys = await req.db.query(
        `
        SELECT *
        FROM brgy
        WHERE
          brgyCode = ?
      `,
        brgyId
      );

      let count = await req.db.query(
        `
        SELECT
          COUNT(CASE WHEN CV.status = 'APPROVED' THEN 1 END) AS verified,
          COUNT(CASE WHEN CV.status = 'PENDING' THEN 1 END) AS unverified
        FROM
          citizen_info C
        LEFT JOIN
          citizen_verifystatus CV
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
        LEFT JOIN
          registration_logs RL
          USING(accountId)
        WHERE
          (RL.brgyId = ? OR AD.brgyId = ?) AND
          C.isDeleted = 0
      `,
        [brgyId, brgyId]
      );

      const result = count.map(({ verified, unverified, brgyId }) => {
        const foundBrgy = brgys.find((brgy) => brgy.brgyCode === brgyId);
        return {
          verified,
          unverified,
          brgyId,
          brgyDesc: foundBrgy ? foundBrgy.brgyDesc : null,
        };
      });

      return res.status(200).json(result);
    } catch (err) {
      console.error(err);
      next(err);
    }
  }
}
