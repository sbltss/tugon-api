import mtz from "moment-timezone";
import hash from "#helpers/hash";
import global from "#helpers/global";
import { isEmpty } from "lodash";
import audit from "#helpers/audit";
import unlinkFiles from "#helpers/unlinkfiles";
import { registrationLogs } from "#helpers/logs";
import { v4 as uuidv4 } from "uuid";
import moment from "moment";
import randomatic from "randomatic";
import { emailNewReg } from "../../../mailer";

let validateCitizenName = async (req) => {
  let { accountId, newData } = req.body;
  let { firstName, middleName, lastName, suffix, birthdate } = newData;

  try {
    let checkName = await req.db.query(
      `
        SELECT
          firstName,
          middleName,
          lastName,
          suffix,
          birthdate
        FROM
        citizen_info
        WHERE
          firstName LIKE ? AND
          COALESCE (middleName, '') LIKE ? AND
          lastName LIKE ? AND
          COALESCE (suffix, '') LIKE ? AND
          birthdate = ? AND
          accountId != ?
      `,
      [
        `${firstName}%`,
        !global.isEmpty(middleName) ? `${middleName}%` : "%",
        `${lastName}%`,
        !global.isEmpty(suffix) ? `${suffix}%` : "%",
        birthdate,
        accountId,
      ]
    );

    if (checkName.length > 0) {
      let filterMatches = checkName.filter((v) => {
        let matchName = `${v.firstName || ""}${v.middleName || ""}${
          v.lastName || ""
        }${v.suffix || ""}`.toLowerCase();
        let registrantName = `${firstName || ""}${middleName || ""}${
          lastName || ""
        }${suffix || ""}`.toLowerCase();
        return registrantName === matchName;
      });

      if (filterMatches.length > 0) {
        return {
          error: 403,
          message: `It seems that you've already registered..`,
        };
      }
    }
    return {
      error: 200,
      message: `proceed.`,
    };
  } catch (err) {
    console.error(err);
    return {
      error: 500,
      message: `An error occurred.`,
    };
  }
};
let validateCitizenEmail = async (req) => {
  let { accountId } = req.currentUser;
  try {
    let { email } = req.body;

    let checkEmail = await req.db.query(
      `
        SELECT
          email
        FROM
        citizen_info
        WHERE
          email LIKE ? AND
          accountId != ?
      `,
      [`${email}%`, accountId]
    );
    if (checkEmail.length > 0) {
      return {
        error: 400,
        message: `Email already exists.`,
      };
    }
    return {
      error: 200,
      message: `proceed.`,
    };
  } catch (err) {
    return {
      error: 500,
      message: `An error occurred.`,
    };
  }
};

let getCitizenInfo = async (req, accountId) => {
  try {
    let citizenInfo = await req.db.query(
      `
        SELECT C.*,CC.primaryEmail,CC.primaryMobile
        FROM citizen_info C
        LEFT JOIN citizen_contacts CC USING(accountId)
        WHERE
          C.isDeleted = ? AND
          C.accountId = ?
      `,
      [0, accountId]
    );
    let citizenStatus = await req.db.query(
      `
        SELECT *
        FROM citizen_verifystatus
        WHERE 
          services IN ("PROFILE") AND 
          accountId = ? AND 
          isDeleted = ?
      `,
      [accountId, 0]
    );
    let citizenFiles = await req.db.query(
      `
        SELECT *
        FROM 
          citizen_files
        WHERE
          module = ? AND 
          isDeleted = ? AND 
          accountId = ?
      `,
      ["PROFILE", 0, accountId]
    );

    let address = await req.db.query(
      `
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
          B.brgyDesc,
          B.cityDesc,
          B.provinceDesc,
          B.regionDesc
        FROM cvms_familymembers F
        LEFT JOIN cvms_addresses A ON A.addressCode = F.addressCode
        LEFT JOIN cvms_brgy B ON B.brgyId = A.brgyId
        WHERE
          F.accountId = ?
      `,
      [accountId]
    );

    let result = citizenInfo.map((i) => {
      i.status = citizenStatus[0].status;
      i.files = citizenFiles;
      i.address = address;
      return i;
    });
    return result;
  } catch (err) {
    next(err);
  }
};

const genCitizenId = (lguCode) => {
  return (lguCode + uuidv4().substring(0, 8)).toUpperCase();
};

export default class Controller {
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
    //carlo
    const { brgyId } = req.currentUser;
    try {
      let result = await req.db.query(
        `
        SELECT * 
        FROM cvms_addresses
        WHERE 
          isDeleted = 0 AND
          brgyId = ?
      `,
        brgyId
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
  async getPhases(req, res, next) {
    //carlo
    const { brgyId } = req.currentUser;
    try {
      const phases = await req.db.query(
        `
        SELECT phase 
        FROM cvms_addresses
        WHERE 
          isDeleted = 0 AND
          brgyId = ?
        GROUP BY
          phase
      `,
        brgyId
      );
      return res.status(200).json(phases);
    } catch (err) {
      next(err);
    }
  }
  async getStreets(req, res, next) {
    //carlo
    const { brgyId } = req.currentUser;
    const { phase } = req.params;
    try {
      const streets = await req.db.query(
        `
        SELECT street 
        FROM cvms_addresses
        WHERE 
          isDeleted = 0 AND
          brgyId = ? AND
          phase = ?
        GROUP BY
          street
      `,
        [brgyId, phase]
      );
      return res.status(200).json(streets);
    } catch (err) {
      next(err);
    }
  }
  async searchAddress(req, res, next) {
    //carlo
    let { unitNo, houseNo, street, phase } = req.body;
    const { brgyId } = req.currentUser;
    try {
      let qry = [];
      let param = [];
      qry.push(`AND B.brgyId = ?`);
      param.push(brgyId);
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
          B.cityId,
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
    //carlo
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let val = req.body;
    let { regionId, provinceId, cityId, brgyId } = req.currentUser;
    try {
      val.addressCode = (
        await req.db.query(
          `SELECT fnAddressCodeGen('${brgyId}') as addressCode`
        )
      )[0].addressCode;
      val.dateCreated = date;
      val.dateUpdated = date;

      let result = await req.db.query(
        `
        INSERT INTO cvms_addresses
        SET ?
      `,
        [{ ...val, regionId, provinceId, cityId, brgyId }]
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
    //carlo
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
  async searchPhaseAndStreet(req, res, next) {
    let { street, phase, brgyDesc } = req.body;
    const { cityId } = req.currentUser;

    try {
      let qry = [];
      let param = [];
      qry.push(`AND B.cityId = ?`);
      param.push(cityId);
      if (!global.isEmpty(brgyDesc)) {
        qry.push(`AND brgyDesc LIKE ?`);
        param.push(`${brgyDesc}%`);
      }
      if (!global.isEmpty(street)) {
        qry.push(`AND street LIKE ?`);
        param.push(`${street}%`);
      }
      if (!global.isEmpty(phase)) {
        qry.push(`AND phase LIKE ?`);
        param.push(`${phase}%`);
      }

      let phaseAndStreet = await req.db.query(
        `
          SELECT
            P.id,
            P.brgyId,
            P.street,
            P.phase, 
            P.brgyDesc
          FROM brgy_phase_street P
          LEFT JOIN cvms_brgy B ON B.brgyId = P.brgyId
          WHERE
            isDeleted = 0
            ${qry.join(" ")}
        `,
        param
      );

      if (phaseAndStreet.length === 0) {
        return res.status(200).json(phaseAndStreet);
      }

      res.status(200).json(phaseAndStreet);
    } catch (err) {
      next(err);
    }
  }

  async getPhaseAndStreet(req, res, next) {
    const { brgyId } = req.currentUser;
    try {
      let result = await req.db.query(
        `
        SELECT * 
        FROM brgy_phase_street
        WHERE 
          isDeleted = 0 AND
          brgyId = ?
      `,
        brgyId
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async createPhaseAndStreet(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let val = req.body;

    try {
      let existingRecord = await req.db.query(
        `
            SELECT *
            FROM brgy_phase_street
            WHERE brgyId = ? AND phase = ? AND street = ?
            `,
        [val.brgyId, val.phase, val.street]
      );

      if (existingRecord.length > 0) {
        return res.status(400).json({
          error: 400,
          message: `Phase or Street has already exists on Barangay ${val.brgyDesc}.`,
        });
      }

      val.dateCreated = date;
      val.dateUpdated = date;
      val.isDeleted = 0;

      let result = await req.db.query(
        `
            INSERT INTO brgy_phase_street
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

  async updatePhaseAndStreet(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { id } = req.params;
    let val = req.body;
    try {
      val.dateUpdated = date;

      let result = await req.db.query(
        `
        UPDATE brgy_phase_street
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

  async getCitizensList(req, res, next) {
    try {
      let citizenInfo = await req.db.query(`
        SELECT C.*,CC.primaryEmail,CC.primaryMobile
        FROM citizen_info C
        LEFT JOIN citizen_contacts CC USING(accountId)
        ORDER BY C.id DESC
      `);
      let citizenStatus = await req.db.query(
        `
        SELECT *
        FROM citizen_verifystatus
        WHERE 
          services = ?
      `,
        ["PROFILE"]
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

      let result = citizenInfo.map((i) => {
        let status = citizenStatus.filter((s) => s.accountId === i.accountId);
        let files = citizenFiles.filter((f) => f.accountId === i.accountId);

        i.status = status[0].status;
        i.files = files;
        return i;
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
  async searchAllCitizen(req, res, next) {
    //carlo
    let { accountId, firstName, middleName, lastName } = req.body;
    const { accountType, module, brgyId, cityId } = req.currentUser;
    if (accountType === "brgy") {
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
          LEFT JOIN
            cvms_familymembers CF 
            USING(accountId)
          LEFT JOIN
            cvms_addresses CA 
            ON CA.addressCode = CF.addressCode
          LEFT JOIN
            registration_logs RL
            USING(accountId)
          WHERE
            (CA.brgyId = ? OR RL.brgyId = ?) AND 
            C.isDeleted = 0 AND
            (CF.isDeleted = 0 OR CF.isDeleted IS NULL)
            ${ucon.join(" ")}
        `,
          [brgyId, brgyId, uparam]
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
            B.regionDesc,
            F.verifiedBy,
            F.dateCreated,
            BU.module AS vModule,
            BU.firstName AS vFirstName,
            BU.lastName AS vLastName,
            BU.contactNumber AS vContactNumber
          FROM cvms_familymembers F
          LEFT JOIN cvms_addresses A ON A.addressCode = F.addressCode
          LEFT JOIN cvms_brgy B ON B.brgyId = A.brgyId
          LEFT JOIN brgy_users BU ON BU.accountId = F.verifiedBy
        `);
        let sectors = await req.db.query(`
          SELECT
            S.accountId,
            S.sectorId,
            S.status,
            S.attachment,
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
    } else {
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
        let citizenInfo = await req.db.query(
          `
        SELECT
          C.*,
          CR.username,
          CC.primaryEmail,
          CC.primaryMobile
        FROM citizen_info C
        LEFT JOIN
          citizen_credential CR
          USING(accountId)
        LEFT JOIN
          citizen_contacts CC
          USING(accountId)
        LEFT JOIN
          registration_logs RL
          USING(accountId)
        WHERE
          C.isDeleted = 0 AND
          RL.cityId = ?
          ${ucon.join(" ")}
      `,
          [cityId, uparam]
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
          B.regionDesc,
          F.verifiedBy,
          F.dateCreated,
          BU.module AS vModule,
          BU.firstName AS vFirstName,
          BU.lastName AS vLastName,
          BU.contactNumber AS vContactNumber
        FROM cvms_familymembers F
        LEFT JOIN cvms_addresses A ON A.addressCode = F.addressCode
        LEFT JOIN cvms_brgy B ON B.brgyId = A.brgyId
        LEFT JOIN brgy_users BU ON BU.accountId = F.verifiedBy
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

  // async searchAllCitizen(req, res, next) {
  //   let { accountId, firstName, middleName, lastName } = req.body;
  //   const { accountType, module, brgyId } = req.currentUser;
  //   if (accountType === "brgy" && module === "admin") {
  //     try {
  //       let ucon = [];
  //       let uparam = [];

  //       if (!global.isEmpty(accountId)) {
  //         ucon.push(`AND accountId = ?`);
  //         uparam.push(accountId);
  //       }
  //       if (!global.isEmpty(firstName)) {
  //         ucon.push(`AND firstName LIKE ?`);
  //         uparam.push(`${firstName}%`);
  //       }
  //       if (!global.isEmpty(middleName)) {
  //         ucon.push(`AND middleName LIKE ?`);
  //         uparam.push(`${middleName}%`);
  //       }
  //       if (!global.isEmpty(lastName)) {
  //         ucon.push(`AND lastName LIKE ?`);
  //         uparam.push(`${lastName}%`);
  //       }
  //       let citizenInfo = await req.db.query(
  //         `
  //         SELECT
  //           C.*,
  //           CR.username,
  //           CC.primaryEmail,
  //           CC.primaryMobile
  //         FROM
  //           citizen_info C
  //         LEFT JOIN
  //           citizen_contacts CC USING(accountId)
  //         LEFT JOIN
  //           citizen_credential CR
  //           USING(accountId)
  //         LEFT JOIN
  //           citizen_verifystatus CV
  //           USING(accountId)
  //         LEFT JOIN
  //           registration_logs RL
  //           USING(accountId)
  //         WHERE
  //           CV.status= "APPROVED" AND
  //           RL.brgyId = ? AND
  //           C.isDeleted = 0
  //           ${ucon.join(" ")}
  //       `,
  //         [brgyId, uparam]
  //       );
  //       let citizenStatus = await req.db.query(
  //         `
  //         SELECT *
  //         FROM citizen_verifystatus
  //         WHERE
  //           services IN ("PROFILE","CVMS")
  //       `
  //       );
  //       let citizenFiles = await req.db.query(
  //         `
  //         SELECT *
  //         FROM
  //           citizen_files
  //         WHERE
  //           module = ? AND
  //           isDeleted = ?
  //       `,
  //         ["PROFILE", 0]
  //       );

  //       let address = await req.db.query(`
  //         SELECT
  //           F.householdId,
  //           F.addressCode,
  //           F.accountId,
  //           F.familyType,
  //           F.familyRelation,
  //           A.unitNo,
  //           A.houseNo,
  //           A.street,
  //           A.phase,
  //           B.brgyId,
  //           B.brgyDesc,
  //           B.cityDesc,
  //           B.provinceDesc,
  //           B.regionDesc,
  //           F.verifiedBy,
  //           F.dateCreated,
  //           BU.module AS vModule,
  //           BU.firstName AS vFirstName,
  //           BU.lastName AS vLastName,
  //           BU.contactNumber AS vContactNumber
  //         FROM cvms_familymembers F
  //         LEFT JOIN cvms_addresses A ON A.addressCode = F.addressCode
  //         LEFT JOIN cvms_brgy B ON B.brgyId = A.brgyId
  //         LEFT JOIN brgy_users BU ON BU.accountId = F.verifiedBy
  //       `);
  //       let sectors = await req.db.query(`
  //         SELECT
  //           S.accountId,
  //           S.sectorId,
  //           C.name,
  //           C.requirements
  //         FROM citizen_sectors S
  //         LEFT JOIN cms_sectors C ON C.id = S.sectorId
  //         WHERE
  //           S.isDeleted = 0
  //       `);
  //       let result = citizenInfo.map((i) => {
  //         let status = citizenStatus.filter((s) => s.accountId === i.accountId);
  //         let files = citizenFiles.filter((f) => f.accountId === i.accountId);
  //         let adds = address.filter((a) => a.accountId === i.accountId);
  //         let sect = sectors.filter((s) => s.accountId === i.accountId);

  //         i.status = status[0].status;
  //         i.files = files;
  //         i.address = adds;
  //         i.sectors = sect;
  //         return i;
  //       });

  //       return res.status(200).json(result);
  //     } catch (err) {
  //       console.error(err);
  //       next(err);
  //     }
  //   } else {
  //     try {
  //       let ucon = [];
  //       let uparam = [];

  //       if (!global.isEmpty(accountId)) {
  //         ucon.push(`AND accountId = ?`);
  //         uparam.push(accountId);
  //       }
  //       if (!global.isEmpty(firstName)) {
  //         ucon.push(`AND firstName LIKE ?`);
  //         uparam.push(`${firstName}%`);
  //       }
  //       if (!global.isEmpty(middleName)) {
  //         ucon.push(`AND middleName LIKE ?`);
  //         uparam.push(`${middleName}%`);
  //       }
  //       if (!global.isEmpty(lastName)) {
  //         ucon.push(`AND lastName LIKE ?`);
  //         uparam.push(`${lastName}%`);
  //       }
  //       let citizenInfo = await req.db.query(
  //         `
  //       SELECT
  //         C.*,
  //         CR.username,
  //         CC.primaryEmail,
  //         CC.primaryMobile
  //       FROM citizen_info C
  //       LEFT JOIN
  //         citizen_credential CR
  //         USING(accountId)
  //       LEFT JOIN
  //         citizen_contacts CC
  //         USING(accountId)
  //       LEFT JOIN
  //         registration_logs RL
  //         USING(accountId)
  //       WHERE
  //         C.isDeleted = 0 AND
  //         RL.cityId = ?
  //         ${ucon.join(" ")}
  //     `,
  //         [cityId, uparam]
  //       );
  //       let citizenStatus = await req.db.query(
  //         `
  //       SELECT *
  //       FROM citizen_verifystatus
  //       WHERE
  //         services IN ("PROFILE","CVMS")
  //     `
  //       );
  //       let citizenFiles = await req.db.query(
  //         `
  //       SELECT *
  //       FROM
  //         citizen_files
  //       WHERE
  //         module = ? AND
  //         isDeleted = ?
  //     `,
  //         ["PROFILE", 0]
  //       );

  //       let address = await req.db.query(`
  //       SELECT
  //         F.householdId,
  //         F.addressCode,
  //         F.accountId,
  //         F.familyType,
  //         F.familyRelation,
  //         A.unitNo,
  //         A.houseNo,
  //         A.street,
  //         A.phase,
  //         B.brgyId,
  //         B.brgyDesc,
  //         B.cityDesc,
  //         B.provinceDesc,
  //         B.regionDesc,
  //         F.verifiedBy,
  //         F.dateCreated,
  //         BU.module AS vModule,
  //         BU.firstName AS vFirstName,
  //         BU.lastName AS vLastName,
  //         BU.contactNumber AS vContactNumber
  //       FROM cvms_familymembers F
  //       LEFT JOIN cvms_addresses A ON A.addressCode = F.addressCode
  //       LEFT JOIN cvms_brgy B ON B.brgyId = A.brgyId
  //       LEFT JOIN brgy_users BU ON BU.accountId = F.verifiedBy
  //     `);
  //       let sectors = await req.db.query(`
  //       SELECT
  //         S.accountId,
  //         S.sectorId,
  //         C.name,
  //         C.requirements
  //       FROM citizen_sectors S
  //       LEFT JOIN cms_sectors C ON C.id = S.sectorId
  //       WHERE
  //         S.isDeleted = 0
  //     `);
  //       let result = citizenInfo.map((i) => {
  //         let status = citizenStatus.filter((s) => s.accountId === i.accountId);
  //         let files = citizenFiles.filter((f) => f.accountId === i.accountId);
  //         let adds = address.filter((a) => a.accountId === i.accountId);
  //         let sect = sectors.filter((s) => s.accountId === i.accountId);

  //         i.status = status[0].status;
  //         i.files = files;
  //         i.address = adds;
  //         i.sectors = sect;
  //         return i;
  //       });

  //       return res.status(200).json(result);
  //     } catch (err) {
  //       console.error(err);
  //       next(err);
  //     }
  //   }
  // }

  async searchCitizen(req, res, next) {
    //carlo
    let { accountId, firstName, middleName, lastName } = req.body;
    const { regionId, provinceId, cityId, brgyId } = req.currentUser;
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
        LEFT JOIN
          cvms_familymembers CF 
          USING(accountId)
        LEFT JOIN
          cvms_addresses CA 
          ON CA.addressCode = CF.addressCode
        LEFT JOIN
          registration_logs RL
          USING(accountId)
        WHERE
          (CA.regionId = ? OR CA.regionId IS NULL) AND
          (CA.provinceId = ? OR CA.provinceId IS NULL) AND
          (CA.cityId = ? OR CA.cityId IS NULL) AND
          (CA.brgyId = ? OR RL.brgyId = ?) AND 
          C.isDeleted = 0 AND
          (CF.isDeleted = 0 OR CF.isDeleted IS NULL)
          ${ucon.join(" ")}
      `,
        [regionId, provinceId, cityId, brgyId, brgyId, uparam]
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

  // async searchCitizen(req, res, next) {
  //   //carlo
  //   let { accountId, firstName, middleName, lastName } = req.body;
  //   const { cityId } = req.currentUser;
  //   try {
  //     let ucon = [];
  //     let uparam = [];
  //     uparam.push(cityId);
  //     uparam.push(cityId);

  //     if (!global.isEmpty(accountId)) {
  //       ucon.push(`AND accountId = ?`);
  //       uparam.push(accountId);
  //     }
  //     if (!global.isEmpty(firstName)) {
  //       ucon.push(`AND firstName LIKE ?`);
  //       uparam.push(`${firstName}%`);
  //     }
  //     if (!global.isEmpty(middleName)) {
  //       ucon.push(`AND middleName LIKE ?`);
  //       uparam.push(`${middleName}%`);
  //     }
  //     if (!global.isEmpty(lastName)) {
  //       ucon.push(`AND lastName LIKE ?`);
  //       uparam.push(`${lastName}%`);
  //     }
  //     let citizenInfo = await req.db.query(
  //       `
  //       SELECT
  //         C.*,
  //         CR.username,
  //         CC.primaryEmail,
  //         CC.primaryMobile,
  //         RL.brgyId AS test,
  //         AD.brgyId AS test2
  //       FROM citizen_info C
  //       LEFT JOIN
  //         citizen_credential CR
  //         USING(accountId)
  //       LEFT JOIN
  //         citizen_contacts CC
  //         USING(accountId)
  //       LEFT JOIN
  //         registration_logs RL
  //         USING(accountId)
  //       LEFT JOIN(
  //         SELECT
  //           CF.addressCode,
  //           CA.brgyId,
  //           CF.accountId,
  //           BR.cityCode AS cityId
  //         FROM
  //           cvms_familymembers CF
  //         LEFT JOIN
  //           cvms_addresses CA
  //           USING(addressCode)
  //         LEFT JOIN
  //           brgy BR
  //           ON BR.brgyCode = CA.brgyId
  //         WHERE
  //           CF.isDeleted= 0
  //         ORDER BY CF.dateCreated DESC
  //       ) AD USING(accountId)
  //       WHERE
  //         C.isDeleted = 0 AND
  //         (RL.cityId= ? OR AD.cityId= ?)
  //         ${ucon.join(" ")}
  //     `,
  //       uparam
  //     );
  //     let citizenStatus = await req.db.query(
  //       `
  //         SELECT *
  //         FROM citizen_verifystatus
  //         WHERE
  //           services IN ("PROFILE","CVMS")
  //       `
  //     );
  //     let citizenFiles = await req.db.query(
  //       `
  //         SELECT *
  //         FROM
  //           citizen_files
  //         WHERE
  //           module = ? AND
  //           isDeleted = ?
  //       `,
  //       ["PROFILE", 0]
  //     );

  //     let address = await req.db.query(`
  //         SELECT
  //           F.householdId,
  //           F.addressCode,
  //           F.accountId,
  //           F.familyType,
  //           F.familyRelation,
  //           A.unitNo,
  //           A.houseNo,
  //           A.street,
  //           A.phase,
  //           B.brgyId,
  //           B.brgyDesc,
  //           B.cityDesc,
  //           B.provinceDesc,
  //           B.regionDesc
  //         FROM cvms_familymembers F
  //         LEFT JOIN cvms_addresses A ON A.addressCode = F.addressCode
  //         LEFT JOIN cvms_brgy B ON B.brgyId = A.brgyId
  //       `);
  //     let sectors = await req.db.query(`
  //         SELECT
  //           S.accountId,
  //           S.sectorId,
  //           C.name,
  //           C.requirements
  //         FROM citizen_sectors S
  //         LEFT JOIN cms_sectors C ON C.id = S.sectorId
  //         WHERE
  //           S.isDeleted = 0
  //       `);
  //     let result = citizenInfo.map((i) => {
  //       let status = citizenStatus.filter((s) => s.accountId === i.accountId);
  //       let files = citizenFiles.filter((f) => f.accountId === i.accountId);
  //       let adds = address.filter((a) => a.accountId === i.accountId);
  //       let sect = sectors.filter((s) => s.accountId === i.accountId);

  //       i.status = status[0].status;
  //       i.files = files;
  //       i.address = adds;
  //       i.sectors = sect;
  //       return i;
  //     });

  //     return res.status(200).json(result);
  //   } catch (err) {
  //     console.error(err);
  //     next(err);
  //   }
  // }
  async searchCitizenTraceData(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");

    let {
      accountId,
      firstName,
      middleName,
      lastName,
      suffix,
      birthdate,
      sex,
      email,
      mobileNumber,
    } = req.body;
    try {
      let val = JSON.stringify(req.body);

      let checkInfo = await req.db.query(
        `
        SELECT
          accountId
        FROM citizen_info
        WHERE 
          accountId = ? AND
          isDeleted = ?
      `,
        [accountId, 0]
      );
      if (checkInfo.length > 0) {
        let citizenData = await getCitizenInfo(req, checkInfo[0].accountId);
        return res.status(200).json(citizenData);
      }

      let result = await req.db.query(
        `
        CALL traceIntegration_registration(
          ?, ?, ?, ?, ?, 
          ?, ?, ?, ?, ?,
          ?, ?
        )`,
        [
          accountId,
          firstName,
          middleName,
          lastName,
          suffix,
          birthdate,
          sex,
          email || "no-email@gmail.com",
          mobileNumber,
          date,
          date,
          val,
        ]
      );
      let results = result[0];

      if (results.length > 0) {
        let citizenData = await getCitizenInfo(req, results[0].accountId);
        return res.status(200).json(citizenData);
      } else {
        return res.status(500).json({ error: 500, message: `Failed.` });
      }
    } catch (err) {
      console.error(err);
      if (err.code == "ER_DUP_ENTRY") {
        let msg = err.message.split("for")[0];
        return res.status(400).json({ error: 400, message: msg.trim() });
      }
      next(err);
    }
  }
  async signupvaliditor(req, res, next) {
    let {
      firstName,
      middleName,
      lastName,
      suffix,
      birthdate,
      username,
      lguCode,
    } = req.body;

    try {
      let checkName = await req.db.query(
        `
        SELECT
          firstName,
          middleName,
          lastName,
          suffix,
          birthdate
        FROM
          citizen_info
        WHERE
          firstName LIKE ? AND
          COALESCE (middleName, '') LIKE ? AND
          lastName LIKE ? AND
          COALESCE (suffix, '') LIKE ? AND
          birthdate = ?
      `,
        [
          `${firstName}%`,
          !global.isEmpty(middleName) ? `${middleName}%` : "%",
          `${lastName}%`,
          !global.isEmpty(suffix) ? `${suffix}%` : "%",
          birthdate,
        ]
      );

      if (checkName.length > 0) {
        let filterMatches = checkName.filter((v) => {
          let matchName = `${v.firstName || ""}${v.middleName || ""}${
            v.lastName || ""
          }${v.suffix || ""}`.toLowerCase();
          let registrantName = `${firstName || ""}${middleName || ""}${
            lastName || ""
          }${suffix || ""}`.toLowerCase();
          return registrantName === matchName;
        });
        if (filterMatches.length > 0) {
          return res
            .status(403)
            .json({ message: `It seems that you've already registered..` });
        }
      }

      if (!global.isEmpty(username)) {
        let verifyCredential = await req.db.query(
          `
          SELECT 
            username
          FROM 
            citizen_credential
          WHERE 
            username = ?
        `,
          [username]
        );

        if (verifyCredential.length > 0) {
          return res.status(409).json({
            error: 409,
            message: `It seems the username you entered already exists.`,
          });
        }
      }

      if (!lguCode || lguCode.length !== 4)
        return res
          .status(400)
          .json({ error: 400, message: "Invalid LGU Code" });

      let accountIdPassed = false;

      while (!accountIdPassed) {
        const accountId = genCitizenId(lguCode);
        let verifyAccountId = await req.db.query(
          `
          SELECT *
          FROM 
            citizen_credential
          WHERE 
            accountId = ?
        `,
          [accountId]
        );
        if (verifyAccountId.length === 0) {
          req.genAccountId = accountId;
          accountIdPassed = true;
        }
      }

      next();
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async signupCitizen(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { accountId, regionId, provinceId, cityId, brgyId } = req.currentUser;
    let {
      firstName,
      middleName,
      lastName,
      suffix,
      birthdate,
      sex,
      email,
      mobileNumber,
      username,
    } = req.body;

    try {
      // const defaultPass = randomatic("Aa0", 8);
      const defaultPass = "Barangay2023";

      let val = JSON.stringify({ ...req.body, accountId: req.genAccountId });
      let npass = await hash.hashPassword(defaultPass);

      let result = await req.db.query(
        `
        CALL citizen_registration_v2(
          ?, ?, ?, ?, ?, 
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,?
        )`,
        [
          req.genAccountId,
          firstName,
          middleName,
          lastName,
          suffix,
          birthdate,
          sex,
          email || "no-email@gmail.com",
          mobileNumber,
          username,
          npass,
          date,
          date,
          val,
          "",
          "",
        ]
      );
      let results = result[0];
      if (results.length > 0) {
        const logs = await registrationLogs(req.db, {
          accountId: req.genAccountId,
          type: "brgy",
          registeredBy: accountId,
          regionId,
          provinceId,
          cityId,
          brgyId,
          dateCreated: date,
        });

        if (!logs.insertId) throw new Error("Failed to insert logs");

        //send email here
        emailNewReg(email, username, defaultPass);

        return res
          .status(200)
          .json({ data: results[0], message: `Successfully Signed Up.` });
      } else {
        return res
          .status(500)
          .json({ error: 500, message: `Failed to signup.` });
      }
    } catch (err) {
      console.error(err);
      if (err.code == "ER_DUP_ENTRY") {
        let msg = err.message.split("for")[0];
        return res.status(400).json({ error: 400, message: msg.trim() });
      }
      next(err);
    }
  }

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
  async updateCitizenProfile(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let {
      accountId: brgyUid,
      module: mdl,
      accountType,
      section,
    } = req.currentUser;
    let { accountId, oldData, newData, sectors } = req.body;

    let parsedOldData = JSON.parse(oldData);
    let parsedNewData = JSON.parse(newData);

    try {
      // let validateName = await validateCitizenName(req);
      // if (validateName.error === 200) {
      const checkEmail = await req.db.query(
        `
        SELECT
          accountId,
          primaryEmail
        FROM
          citizen_contacts
        WHERE
          primaryEmail= ?
      `,
        parsedNewData.primaryEmail
      );

      if (checkEmail.length > 0 && checkEmail[0].accountId !== accountId) {
        if (parsedNewData.primaryEmail !== "no-email@gmail.com") {
          return res
            .status(409)
            .json({ error: 409, message: "Email address already in use" });
        }
      }

      if (
        parsedNewData.primaryEmail &&
        (checkEmail.length === 0 ||
          parsedNewData.primaryEmail === "no-email@gmail.com")
      ) {
        let updateEmail = await req.db.query(
          `
            UPDATE citizen_contacts
            SET ?
            WHERE
            accountId = ?
          `,
          [
            { primaryEmail: parsedNewData.primaryEmail, dateUpdated: date },
            accountId,
          ]
        );
        if (updateEmail.affectedRows === 0)
          throw new Error("Failed to update email");
      }
      parsedNewData.dateUpdated = date;
      delete parsedNewData.primaryEmail;
      let result = await req.db.query(
        `
          UPDATE citizen_info
          SET ?
          WHERE
          accountId = ?
        `,
        [parsedNewData, accountId]
      );

      let auditObj = {
        createdBy: brgyUid,
        accountId: accountId,
        userPriviledge: `${mdl}:${accountType}:${section}`,
        actionType: "UPDATE PROFILE",
        crud: "UPDATE",
        oldValue: JSON.stringify(parsedOldData),
        newValue: JSON.stringify(parsedNewData),
        dateCreated: date,
        dateUpdated: date,
      };
      if (!isEmpty(sectors)) {
        await req.db.query(
          `
            UPDATE citizen_sectors
            SET isDeleted = 1
            WHERE
              accountId = ?
          `,
          [accountId]
        );
        for (let s of sectors) {
          let check = await req.db.query(
            `
              SELECT *
              FROM citizen_sectors
              WHERE
                accountId = ? AND
                sectorId = ?
            `,
            [accountId, s]
          );

          if (check.length > 0) {
            await req.db.query(
              `
                UPDATE citizen_sectors
                SET isDeleted = 0
                WHERE
                  accountId = ? AND
                  sectorId = ?
              `,
              [accountId, s]
            );
          } else {
            await req.db.query(
              `
                INSERT INTO citizen_sectors
                SET ?
              `,
              {
                accountId: accountId,
                sectorId: s,
                dateCreated: date,
                dateUpdated: date,
              }
            );
          }
        }
      }
      await audit.auditData(req, auditObj);
      if (result.affectedRows > 0) {
        return res.status(200).json({ message: `Successfully updated.` });
      } else {
        return res.status(500).json({ error: 500, message: `Update errror.` });
      }
      // } else {
      //   return res.status(validateName.error).json(validateName);
      // }
    } catch (err) {
      console.error(err);
      next(err);
    }
  }
  async uploadSupportingFiles(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let {
      accountId: brgyUid,
      module: mdl,
      accountType,
      section,
    } = req.currentUser;
    let { accountId } = req.body;
    let files = req.files;
    let auditStatus;

    let transaction;
    try {
      if (Object.keys(files).length === 0) {
        return res.status(400).json({
          error: 400,
          message: "No files were uploaded",
        });
      }

      transaction = await req.db.getConnection();

      await transaction.beginTransaction();

      if (!global.isEmpty(files.identification)) {
        let idn = files.identification[0].path;
        let [checkId] = await transaction.query(
          `
          SELECT imageId
          FROM citizen_files
          WHERE 
            accountId = ? AND
            module = ? AND
            type = ? AND 
            isDeleted = ?
        `,
          [accountId, "PROFILE", "PROFILE_ID", 0]
        );

        if (checkId.length > 0) {
          auditStatus = "UPDATE";
          let [update] = await transaction.query(
            `
            UPDATE citizen_files
            SET ? 
            WHERE 
              imageId = ? 
          `,
            [
              {
                image: idn,
                dateUpdated: date,
              },
              checkId[0].imageId,
            ]
          );
          if (!update.affectedRows) {
            throw {
              error: 500,
              loc: "update profile_id",
              message: "An error occurred. Please try again",
            };
          }
        } else {
          auditStatus = "CREATE";
          let [genUUID] = await transaction.query(`
            SELECT UUID() AS uuid
          `);
          const { uuid } = genUUID[0];

          let [insert] = await transaction.query(
            `
            INSERT INTO citizen_files
            SET ?  
          `,
            [
              {
                accountId: accountId,
                imageId: uuid,
                image: idn,
                module: "PROFILE",
                type: "PROFILE_ID",
                dateCreated: date,
                dateUpdated: date,
              },
            ]
          );
          if (!insert.insertId) {
            throw {
              error: 500,
              loc: "add profile_id",
              message: "An error occurred. Please try again",
            };
          }
        }
      }
      if (!global.isEmpty(files.document)) {
        let docu = files.document[0].path;
        let [checkId] = await transaction.query(
          `
          SELECT imageId 
          FROM citizen_files
          WHERE 
            accountId = ? AND
            module = ? AND
            type = ? AND 
            isDeleted = ?
        `,
          [accountId, "PROFILE", "PROFILE_DOCUMENT", 0]
        );
        if (checkId.length > 0) {
          auditStatus = "UPDATE";
          let [update] = await transaction.query(
            `
            UPDATE citizen_files
            SET ? 
            WHERE 
              imageId = ? 
          `,
            [
              {
                image: docu,
                dateUpdated: date,
              },
              checkId[0].imageId,
            ]
          );
          if (!update.affectedRows) {
            throw {
              error: 500,
              loc: "update profile_document",
              message: "An error occurred. Please try again",
            };
          }
        } else {
          auditStatus = "CREATE";
          let [genUUID] = await transaction.query(`
            SELECT UUID() AS uuid
          `);
          const { uuid } = genUUID[0];
          let [insert] = await transaction.query(
            `
            INSERT INTO citizen_files
            SET ?  
          `,
            [
              {
                accountId: accountId,
                imageId: uuid,
                image: docu,
                module: "PROFILE",
                type: "PROFILE_DOCUMENT",
                dateCreated: date,
                dateUpdated: date,
              },
            ]
          );
          if (!insert.insertId) {
            throw {
              error: 500,
              loc: "add profile_document",
              message: "An error occurred. Please try again",
            };
          }
        }
      }
      let auditObj = {
        createdBy: brgyUid,
        accountId: accountId,
        userPriviledge: `${mdl}:${accountType}:${section}`,
        actionType: "UPLOAD FILES",
        crud: auditStatus,
        newValue: JSON.stringify({ body: req.body, files: req.files }),
        dateCreated: date,
        dateUpdated: date,
      };

      await audit.auditData(req, auditObj);

      await transaction.commit();
      await transaction.release();
      res.status(200).json({ message: "Files uploaded successfully" });
    } catch (err) {
      unlinkFiles.unlinkProfileFiles(req.files);
      await transaction.rollback();
      await transaction.release();
      console.error(err);
      next(err);
    }
  }
  // async approveApplication(req, res, next) {
  //   let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
  //   let {
  //     accountId: brgyUid,
  //     module: mdl,
  //     accountType,
  //     section,
  //   } = req.currentUser;
  //   let { accountId, sector, idType } = req.body;
  //   let files = req.files;
  //   console.log("Request Body:", req.body);
  //   let docsStatus;
  //   try {
  //     let checkDocs = await req.db.query(
  //       `
  //       SELECT *
  //       FROM citizen_files
  //       WHERE accountId = ?
  //     `,
  //       [accountId]
  //     );
  //     if (checkDocs.length > 0) {
  //       let profileID = checkDocs.find((e) => e.type === "PROFILE_ID");
  //       let profileDocs = checkDocs.find((e) => e.type === "PROFILE_DOCUMENT");
  //       if (!isEmpty(sector)) {
  //         await req.db.query(
  //           `
  //           UPDATE citizen_sectors
  //           SET isDeleted = 1
  //           WHERE
  //             accountId = ?
  //         `,
  //           [accountId]
  //         );
  //         for (let s of sector) {
  //           let check = await req.db.query(
  //             `
  //             SELECT *
  //             FROM citizen_sectors
  //             WHERE
  //               accountId = ? AND
  //               sectorId = ?
  //           `,
  //             [accountId, s.id]
  //           );
  //           if (check.length > 0) {
  //             console.log(
  //               `
  //             UPDATE citizen_sectors
  //             SET isDeleted = 0
  //             WHERE
  //               accountId = ? AND
  //               sectorId = ?
  //           `,
  //               [accountId, s.id]
  //             );
  //             await req.db.query(
  //               `
  //               UPDATE citizen_sectors
  //               SET isDeleted = 0
  //               WHERE
  //                 accountId = ? AND
  //                 sectorId = ?
  //             `,
  //               [accountId, s.id]
  //             );
  //           } else {
  //             await req.db.query(
  //               `
  //               INSERT INTO citizen_sectors
  //               SET ?
  //             `,
  //               {
  //                 accountId: accountId,
  //                 sectorId: s.id,
  //                 dateCreated: date,
  //                 dateUpdated: date,
  //               }
  //             );
  //             let [genUUID] = await req.db.query(`
  //             SELECT UUID() AS uuid
  //             `);
  //             const { uuid } = genUUID;
  //             let id = files.file[0].path;
  //             console.log(id);
  //             await req.db.query(
  //               `
  //                 INSERT INTO citizen_files
  //                 SET ?
  //               `,
  //               {
  //                 accountId: accountId,
  //                 imageId: uuid,
  //                 image: id,
  //                 module: "PROFILE",
  //                 type: idType,
  //                 dateCreated: date,
  //                 dateUpdated: date,
  //               }
  //             );
  //           }
  //         }
  //       }
  //       let val = {
  //         status: "APPROVED",
  //         isDeleted: 0,
  //         dateUpdated: date,
  //       };
  //       let result = await req.db.query(
  //         `
  //         UPDATE citizen_verifystatus
  //         SET ?
  //         WHERE
  //         accountId = ? AND
  //         services = ?
  //       `,
  //         [val, accountId, "PROFILE"]
  //       );

  //       if (result.affectedRows > 0) {
  //         let auditObj = {
  //           createdBy: brgyUid,
  //           accountId: accountId,
  //           userPriviledge: `${mdl}:${accountType}:${section}`,
  //           actionType: "UPDATE PROFILE STATUS",
  //           crud: "UPDATE",
  //           newValue: JSON.stringify(val),
  //           dateCreated: date,
  //           dateUpdated: date,
  //         };

  //         await audit.auditData(req, auditObj);
  //         return res
  //           .status(200)
  //           .json({ status: "APPROVED", message: `Approved successfully.` });
  //       } else {
  //         return res.status(200).json({
  //           status: "FAILED",
  //           message: `Failed to approve application.`,
  //         });
  //       }
  //     } else {
  //       return res.status(401).json({
  //         error: 401,
  //         message:
  //           "Please upload supporting documents first before approving the application of the citizen.",
  //       });
  //     }
  //   } catch (err) {
  //     console.error(err);
  //     next(err);
  //   }
  // }

  async approveApplication(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let {
      accountId: brgyUid,
      module: mdl,
      accountType,
      section,
    } = req.currentUser;
    let { accountId, sector, idType } = req.body;
    let files = req.files;
    let docsStatus;
    try {
      let checkDocs = await req.db.query(
        `
        SELECT * 
        FROM citizen_files
        WHERE accountId = ? 
      `,
        [accountId]
      );
      if (checkDocs.length > 0) {
        let profileID = checkDocs.find((e) => e.type === "PROFILE_ID");
        let profileDocs = checkDocs.find((e) => e.type === "PROFILE_DOCUMENT");
        if (!isEmpty(sector)) {
          await req.db.query(
            `
            UPDATE citizen_sectors
            SET isDeleted = 1
            WHERE
              accountId = ?
          `,
            [accountId]
          );
          for (let s of sector) {
            let check = await req.db.query(
              `
              SELECT *  
              FROM citizen_sectors
              WHERE
                accountId = ? AND
                sectorId = ?
            `,
              [accountId, s]
            );
            if (check.length > 0) {
              await req.db.query(
                `
                UPDATE citizen_sectors
                SET isDeleted = 0
                WHERE
                  accountId = ? AND
                  sectorId = ?
              `,
                [accountId, s]
              );
            } else {
              console.log(s);
              await req.db.query(
                `
                INSERT INTO citizen_sectors
                SET ?
              `,
                {
                  accountId: accountId,
                  sectorId: s,
                  status: +s === 1 ? "APPROVED" : "PENDING",
                  dateCreated: date,
                  dateUpdated: date,
                  attachment: files.find((f) => f.fieldname == s).path,
                }
              );
              // let [genUUID] = await req.db.query(`
              // SELECT UUID() AS uuid
              // `);
              // const { uuid } = genUUID;
              // let id = files.file ? files.file[0].path : null;
              // await req.db.query(
              //   `
              //     INSERT INTO citizen_files
              //     SET ?
              //   `,
              //   {
              //     accountId: accountId,
              //     imageId: uuid,
              //     image: id,
              //     module: "PROFILE",
              //     type: idType,
              //     dateCreated: date,
              //     dateUpdated: date,
              //   }
              // );
            }
          }
        }
        let val = {
          status: "APPROVED",
          isDeleted: 0,
          dateUpdated: date,
        };
        let result = await req.db.query(
          `
          UPDATE citizen_verifystatus
          SET ?
          WHERE
          accountId = ? AND
          services = ?
        `,
          [val, accountId, "PROFILE"]
        );

        if (result.affectedRows > 0) {
          let auditObj = {
            createdBy: brgyUid,
            accountId: accountId,
            userPriviledge: `${mdl}:${accountType}:${section}`,
            actionType: "UPDATE PROFILE STATUS",
            crud: "UPDATE",
            newValue: JSON.stringify(val),
            dateCreated: date,
            dateUpdated: date,
          };

          await audit.auditData(req, auditObj);
          return res
            .status(200)
            .json({ status: "APPROVED", message: `Approved successfully.` });
        } else {
          return res.status(200).json({
            status: "FAILED",
            message: `Failed to approve application.`,
          });
        }
      } else {
        return res.status(401).json({
          error: 401,
          message:
            "Please upload supporting documents first before approving the application of the citizen.",
        });
      }
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async searchHouseholdMembers(req, res, next) {
    let { householdId } = req.body;
    try {
      let result = await req.db.query(
        `
        SELECT
          C.accountId,
          F.familyRelation,
          F.familyType,
          C.firstName,
          C.middleName,
          C.lastName,
          C.suffix,
          C.birthdate,
          C.sex
        FROM
          cvms_familymembers F
        LEFT JOIN citizen_info C USING(accountId)
        WHERE
          SUBSTR(F.householdId,1,19) = SUBSTR(?,1,19)
      `,
        [householdId]
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
  // async createHousehold(req, res, next) {
  //   let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
  //   let {
  //     accountId: brgyUid,
  //     module: mdl,
  //     accountType,
  //     section,
  //   } = req.currentUser;

  //   let { isHead, addressCode, accountId, familyHeadId, familyRelation } =
  //     req.body;
  //   try {
  //     let ProfileStatus = await req.db.query(
  //       `
  //     SELECT *
  //     FROM citizen_verifystatus
  //     WHERE
  //       accountId = ? AND
  //       services = ? AND
  //       isDeleted = ? AND
  //       status = ?
  //   `,
  //       [accountId, "PROFILE", 0, "PENDING"]
  //     );

  //     if (ProfileStatus.length > 0) {
  //       return res
  //         .status(401)
  //         .json({ error: 401, message: `Citizen is not yet verified.` });
  //     }

  //     let isExists = await req.db.query(
  //       `
  //       SELECT *
  //       FROM cvms_familymembers
  //       WHERE
  //       accountId = ? AND
  //       status = ?
  //     `,
  //       [accountId, 1]
  //     );
  //     if (isExists.length > 0) {
  //       return res.status(401).json({ error: 401, message: `Already exists.` });
  //     }
  //     let sql;
  //     let param;
  //     if (isHead == 0 && isEmpty(familyHeadId)) {
  //       return res.status(401).json({
  //         error: 401,
  //         message: `Maari po lamang na piliin ang inyong haligi ng tahanan upang kayo ay mapabilang sa kanyang pamilya.`,
  //       });
  //     } else if (isHead == 0 && !isEmpty(familyHeadId)) {
  //       sql = `
  //         SELECT *
  //         FROM cvms_familymembers
  //         WHERE
  //         addressCode = ? AND
  //         SUBSTR(familyType,3,3) = ? AND
  //         accountId = ?
  //         ORDER BY familyType DESC LIMIT 1
  //       `;
  //       param = [addressCode, "A", familyHeadId];
  //     } else {
  //       sql = `
  //         SELECT *
  //         FROM cvms_familymembers
  //         WHERE
  //         addressCode = ? AND
  //         SUBSTR(familyType,3,3) = ?
  //         ORDER BY familyType DESC LIMIT 1
  //       `;
  //       param = [addressCode, "A"];
  //     }
  //     let checkFamily = await req.db.query(sql, param);
  //     if (isHead == 0 && checkFamily.length == 0) {
  //       return res.status(401).json({
  //         error: 401,
  //         message: `Maari po lamang na magparehistro muna ang inyong haligi ng tahanan bago ang mga myembro neto.`,
  //       });
  //     }

  //     let result = await req.db.query(
  //       `
  //       CALL household_registration(
  //         ?, ?, ?, ?, ?,
  //         ?, ?, ?, ?, ?
  //       )
  //     `,
  //       [
  //         brgyUid,
  //         isHead,
  //         accountId,
  //         addressCode,
  //         checkFamily.length > 0 ? checkFamily[0].familyType : "00A",
  //         familyRelation,
  //         JSON.stringify(req.body),
  //         date,
  //         date,
  //         `${mdl}:${accountType}:${section}`,
  //       ]
  //     );
  //     result = result[0];
  //     if (result.length > 0) {
  //       res.status(200).json({ message: `tagged.` });
  //     } else {
  //       res.status(500).json({ error: 500, message: `error.` });
  //     }
  //   } catch (err) {
  //     console.error(err);
  //     next(err);
  //   }
  // }
  // async changeHousehold(req, res, next) {
  //   let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
  //   let {
  //     accountId: brgyUid,
  //     module: mdl,
  //     accountType,
  //     section,
  //   } = req.currentUser;

  //   let { isHead, addressCode, accountId, familyHeadId, familyRelation } =
  //     req.body;
  //   try {
  //     let ProfileStatus = await req.db.query(
  //       `
  //       SELECT *
  //       FROM citizen_verifystatus
  //       WHERE
  //         accountId = ? AND
  //         services = ? AND
  //         isDeleted = ? AND
  //         status = ?
  //     `,
  //       [accountId, "PROFILE", 0, "PENDING"]
  //     );

  //     if (ProfileStatus.length > 0) {
  //       return res
  //         .status(401)
  //         .json({ error: 401, message: `Citizen is not yet verified.` });
  //     }
  //     let isExists = await req.db.query(
  //       `
  //       SELECT *
  //       FROM cvms_familymembers
  //       WHERE
  //       accountId = ? AND
  //       status = ? AND
  //       addressCode = ?
  //     `,
  //       [accountId, 1, addressCode]
  //     );

  //     //CARLO - PILALITAN KO 'addressCode <> ?' to 'addressCode = ?'
  //     if (isExists.length > 0) {
  //       return res.status(401).json({ error: 401, message: `Already exists.` });
  //     }

  //     let sql;
  //     let param;
  //     if (isHead == 0 && isEmpty(familyHeadId)) {
  //       return res.status(401).json({
  //         error: 401,
  //         message: `Maari po lamang na piliin ang inyong haligi ng tahanan upang kayo ay mapabilang sa kanyang pamilya.`,
  //       });
  //     } else if (isHead == 0 && !isEmpty(familyHeadId)) {
  //       sql = `
  //         SELECT *
  //         FROM cvms_familymembers
  //         WHERE
  //         addressCode = ? AND
  //         SUBSTR(familyType,3,3) = ? AND
  //         accountId = ?
  //         ORDER BY familyType DESC LIMIT 1
  //       `;
  //       param = [addressCode, "A", familyHeadId];
  //     } else {
  //       sql = `
  //         SELECT *
  //         FROM cvms_familymembers
  //         WHERE
  //         addressCode = ? AND
  //         SUBSTR(familyType,3,3) = ?
  //         ORDER BY familyType DESC LIMIT 1
  //       `;
  //       param = [addressCode, "A"];
  //     }
  //     let checkFamily = await req.db.query(sql, param);
  //     if (isHead == 0 && checkFamily.length == 0) {
  //       return res.status(401).json({
  //         error: 401,
  //         message: `Maari po lamang na magparehistro muna ang inyong haligi ng tahanan bago ang mga myembro neto.`,
  //       });
  //     }
  //     await req.db.query(
  //       `
  //       UPDATE cvms_familymembers
  //       SET ?
  //       WHERE
  //         accountId = ? AND
  //         addressCode <> ?
  //     `,
  //       [
  //         {
  //           isDeleted: 1,
  //           dateUpdated: date,
  //         },
  //         accountId,
  //         addressCode,
  //       ]
  //     );
  //     let result = await req.db.query(
  //       `
  //       CALL household_registration(
  //         ?, ?, ?, ?, ?,
  //         ?, ?, ?, ?, ?
  //       )
  //     `,
  //       [
  //         brgyUid,
  //         isHead,
  //         accountId,
  //         addressCode,
  //         checkFamily.length > 0 ? checkFamily[0].familyType : "00A",
  //         familyRelation,
  //         JSON.stringify(req.body),
  //         date,
  //         date,
  //         `${mdl}:${accountType}:${section}`,
  //       ]
  //     );
  //     result = result[0];
  //     if (result.length > 0) {
  //       res.status(200).json({ message: `tagged.` });
  //     } else {
  //       res.status(500).json({ error: 500, message: `error.` });
  //     }
  //   } catch (err) {
  //     next(err);
  //   }
  // }

  async createHousehold(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let {
      accountId: brgyUid,
      module: mdl,
      accountType,
      section,
      brgyId,
    } = req.currentUser;

    let { isHead, addressCode, accountId, familyHeadId, familyRelation } =
      req.body;
    try {
      let ProfileStatus = await req.db.query(
        `
      SELECT *
      FROM citizen_verifystatus
      WHERE 
        accountId = ? AND
        services = ? AND
        isDeleted = ? AND 
        status = ?
    `,
        [accountId, "PROFILE", 0, "PENDING"]
      );

      if (ProfileStatus.length > 0) {
        return res
          .status(401)
          .json({ error: 401, message: `Citizen is not yet verified.` });
      }

      let isExists = await req.db.query(
        `
        SELECT * 
        FROM cvms_familymembers
        WHERE
        accountId = ? AND
        status = ?
      `,
        [accountId, 1]
      );
      if (isExists.length > 0) {
        return res.status(401).json({ error: 401, message: `Already exists.` });
      }
      let sql;
      let param;
      if (isHead == 0 && isEmpty(familyHeadId)) {
        return res.status(401).json({
          error: 401,
          message: `Maari po lamang na piliin ang inyong haligi ng tahanan upang kayo ay mapabilang sa kanyang pamilya.`,
        });
      } else if (isHead == 0 && !isEmpty(familyHeadId)) {
        sql = `
          SELECT * 
          FROM cvms_familymembers
          WHERE
          addressCode = ? AND
          SUBSTR(familyType,3,3) = ? AND
          accountId = ?
          ORDER BY familyType DESC LIMIT 1
        `;
        param = [addressCode, "A", familyHeadId];
      } else {
        sql = `
          SELECT * 
          FROM cvms_familymembers
          WHERE
          addressCode = ? AND
          SUBSTR(familyType,3,3) = ?
          ORDER BY familyType DESC LIMIT 1
        `;
        param = [addressCode, "A"];
      }
      let checkFamily = await req.db.query(sql, param);
      if (isHead == 0 && checkFamily.length == 0) {
        return res.status(401).json({
          error: 401,
          message: `Maari po lamang na magparehistro muna ang inyong haligi ng tahanan bago ang mga myembro neto.`,
        });
      }

      const checkBrgy = await req.db.query(
        `
        SELECT 
          CA.brgyId,
          CF.id
        FROM
          cvms_familymembers CF
        LEFT JOIN
          cvms_addresses CA
          USING(addressCode)
        WHERE
          CF.accountId= ?
        ORDER BY CF.id DESC LIMIT 1
      `,
        accountId
      );

      const status = 1;

      let result = await req.db.query(
        `
        CALL household_registration(
          ?, ?, ?, ?, ?, 
          ?, ?, ?, ?, ?, ?, ?
        )
      `,
        [
          brgyUid,
          isHead,
          accountId,
          addressCode,
          checkFamily.length > 0 ? checkFamily[0].familyType : "00A",
          familyRelation,
          JSON.stringify(req.body),
          date,
          date,
          `${mdl}:${accountType}:${section}`,
          status,
          req.file.path || "",
        ]
      );
      result = result[0];

      if (result.length > 0 && status === 1) {
        res.status(200).json({ message: `Address transfer approved.` });
      } else if (result.length > 0 && status === 0) {
        res
          .status(200)
          .json({ message: `Address transfer pending for approval.` });
      } else {
        res.status(500).json({ error: 500, message: `error.` });
      }
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async changeHousehold(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let {
      accountId: brgyUid,
      module: mdl,
      accountType,
      section,
      brgyId,
    } = req.currentUser;

    let { isHead, addressCode, accountId, familyHeadId, familyRelation } =
      req.body;

    console.log(accountId);
    try {
      let ProfileStatus = await req.db.query(
        `
        SELECT *
        FROM citizen_verifystatus
        WHERE 
          accountId = ? AND
          services = ? AND
          isDeleted = ? AND 
          status = ?
      `,
        [accountId, "PROFILE", 0, "PENDING"]
      );

      if (ProfileStatus.length > 0) {
        return res
          .status(401)
          .json({ error: 401, message: `Citizen is not yet verified.` });
      }
      let isExists = await req.db.query(
        `
        SELECT * 
        FROM cvms_familymembers
        WHERE
        accountId = ? AND
        status = ? AND
        addressCode = ?
      `,
        [accountId, 1, addressCode]
      );

      //CARLO - PILALITAN KO 'addressCode <> ?' to 'addressCode = ?'
      if (isExists.length > 0) {
        return res.status(401).json({ error: 401, message: `Already exists.` });
      }

      let sql;
      let param;
      if (isHead == 0 && isEmpty(familyHeadId)) {
        return res.status(401).json({
          error: 401,
          message: `Maari po lamang na piliin ang inyong haligi ng tahanan upang kayo ay mapabilang sa kanyang pamilya.`,
        });
      } else if (isHead == 0 && !isEmpty(familyHeadId)) {
        sql = `
          SELECT * 
          FROM cvms_familymembers
          WHERE
          addressCode = ? AND
          SUBSTR(familyType,3,3) = ? AND
          accountId = ?
          ORDER BY familyType DESC LIMIT 1
        `;
        param = [addressCode, "A", familyHeadId];
      } else {
        sql = `
          SELECT * 
          FROM cvms_familymembers
          WHERE
          addressCode = ? AND
          SUBSTR(familyType,3,3) = ?
          ORDER BY familyType DESC LIMIT 1
        `;
        param = [addressCode, "A"];
      }
      let checkFamily = await req.db.query(sql, param);
      if (isHead == 0 && checkFamily.length == 0) {
        return res.status(401).json({
          error: 401,
          message: `Maari po lamang na magparehistro muna ang inyong haligi ng tahanan bago ang mga myembro neto.`,
        });
      }
      await req.db.query(
        `
        UPDATE cvms_familymembers
        SET ?
        WHERE
          accountId = ? AND
          addressCode <> ? 
      `,
        [
          {
            isDeleted: 1,
            dateUpdated: date,
          },
          accountId,
          addressCode,
        ]
      );

      const checkBrgy = await req.db.query(
        `
        SELECT 
          CA.brgyId,
          CF.id
        FROM
          cvms_familymembers CF
        LEFT JOIN
          cvms_addresses CA
          USING(addressCode)
        WHERE
          CF.accountId= ?
        ORDER BY CF.id DESC LIMIT 1
      `,
        accountId
      );

      const status = 1;

      let result = await req.db.query(
        `
        CALL household_registration(
          ?, ?, ?, ?, ?,  
          ?, ?, ?, ?, ?, ?, ?
        )
      `,
        [
          brgyUid,
          isHead,
          accountId,
          addressCode,
          checkFamily.length > 0 ? checkFamily[0].familyType : "00A",
          familyRelation,
          JSON.stringify(req.body),
          date,
          date,
          `${mdl}:${accountType}:${section}`,
          status,
          req.file.path || "",
        ]
      );
      result = result[0];
      if (result.length > 0 && status === 1) {
        res.status(200).json({ message: `Address transfer approved.` });
      } else if (result.length > 0 && status === 0) {
        res
          .status(200)
          .json({ message: `Address transfer pending for approval.` });
      } else {
        res.status(500).json({ error: 500, message: `error.` });
      }
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async getVerifiedCitizens(req, res, next) {
    const { brgyId } = req.currentUser;
    try {
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
          (RL.brgyId = ? OR AD.brgyId = ?) AND
          C.isDeleted = 0
      `,
        [brgyId, brgyId]
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

  async getUnverifiedCitizens(req, res, next) {
    const { brgyId } = req.currentUser;
    try {
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
        LEFT JOIN
          registration_logs RL
          USING(accountId)
        WHERE
          CV.status= "PENDING" AND
          RL.brgyId = ? AND
          C.isDeleted = 0
      `,
        [brgyId]
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

  async getTransferredCitizens(req, res, next) {
    let { brgyId } = req.currentUser;
    console.log(brgyId);
    try {
      const citizenAddresses = await req.db.query(
        `
        SELECT CI.*,
          CF.transferredTo,
          CF.status,
          CF.householdId
        FROM
          cvms_familymembers CF
        LEFT JOIN
          cvms_addresses CA
          USING(addressCode)
        LEFT JOIN citizen_info CI
          USING(accountId)
        WHERE
          CA.brgyId = ? AND
          CF.transferredTo IS NOT NULL
        ORDER BY dateUpdated DESC

      `,
        [brgyId]
      );

      console.log(citizenAddresses);
      for (const citizen of citizenAddresses) {
        const newAddress = await req.db.query(
          `
          SELECT CA.*,
            CF.status,
            CF.accountId,
            CF.householdId,
            CF.attachment,
            CF.dateCreated,
            CF.dateUpdated
          FROM
            cvms_familymembers CF
          LEFT JOIN
            cvms_addresses CA
            USING(addressCode)
          WHERE CF.householdId = ?
        `,
          citizen.transferredTo
        );

        citizen.newAddress = newAddress[0];
      }
      citizenAddresses.sort(
        (a, b) => a.newAddress.status - b.newAddress.status
      );

      return res.status(200).json(citizenAddresses);
    } catch (err) {
      console.error(err);
      next(err);
    }
  }
}
