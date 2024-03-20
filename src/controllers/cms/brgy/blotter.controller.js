import moment from "moment";
import mtz from "moment-timezone";
import hash from "#helpers/hash";
import { isEmpty } from "lodash";

export default class Controller {
  async getBlotters(req, res, next) {
    try {
      let response = [];

      let result = await req.db.query(`
        SELECT 
          BB.*,
          BT.name as caseName
        FROM 
          brgy_blotters BB
        LEFT JOIN brgy_blotter_type BT ON BT.id = BB.caseType
        WHERE
          BB.status = 0
      `);

      for (let res of result) {
        let complainants = await req.db.query(
          `
          SELECT 
            *
          FROM 
            brgy_blotter_complainants
          WHERE
            blotterId = ?
        `,
          res.blotterId
        );

        let respondents = await req.db.query(
          `
          SELECT 
            *
          FROM 
            brgy_blotter_respondents
          WHERE
            blotterId = ?
        `,
          res.blotterId
        );

        response.push({
          ...res,
          complainants,
          respondents,
        });
      }

      return res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async getBlotter(req, res, next) {
    const { blotterId } = req.query;

    try {
      let response = [];

      let result = await req.db.query(
        `
        SELECT 
          BB.*,
          BT.name as caseName
        FROM 
          brgy_blotters BB
        LEFT JOIN brgy_blotter_type BT ON BT.id = BB.caseType
        WHERE
          BB.blotterId = ? AND
          BB.status = 0
      `,
        blotterId
      );

      if (result.length < 0) {
        return res.status(500).json({
          error: 500,
          message: "Blotter doesn't exist in the database.",
        });
      }

      let complainants = await req.db.query(
        `
        SELECT 
          *
        FROM 
          brgy_blotter_complainants
        WHERE
          blotterId = ? AND 
          status = 0
      `,
        blotterId
      );

      let respondents = await req.db.query(
        `
        SELECT 
          *
        FROM 
          brgy_blotter_respondents
        WHERE
          blotterId = ? AND
          status = 0
      `,
        blotterId
      );

      let statements = await req.db.query(
        `
        SELECT 
          *
        FROM 
          brgy_blotter_statements
        WHERE
          blotterId = ? AND
          status = 0
      `,
        blotterId
      );

      let clauses = await req.db.query(
        `
          SELECT 
            *
          FROM 
            brgy_blotter_clauses
          WHERE
            blotterId = ? AND
            status = 0
        `,
        blotterId
      );

      let summons = await req.db.query(
        `
        SELECT 
          *
        FROM 
        brgy_blotter_summons
        WHERE
          blotterId = ?
      `,
        blotterId
      );

      let settlements = await req.db.query(
        `
        SELECT 
          *
        FROM 
        brgy_blotter_settlements
        WHERE
          blotterId = ?
      `,
        blotterId
      );

      let resSummon = [];

      for (const summon of summons) {
        let attendance = await req.db.query(
          `
          SELECT 
            *
          FROM 
          brgy_blotter_attendances
          WHERE
            summonId = ?
        `,
          summon.summonId
        );

        resSummon.push({
          ...summon,
          attendance,
        });
      }

      response.push({
        ...result[0],
        complainants,
        respondents,
        statements,
        clauses,
        summons: resSummon,
        settlements,
      });

      return res.status(200).json(response[0]);
    } catch (err) {
      next(err);
    }
  }

  async addBlotter(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { complainants, respondents, caseDetails, ...rest } = req.body;
    let transaction;

    try {
      transaction = await req.db.getConnection();

      await transaction.beginTransaction();

      const blotterId = (
        await req.db.query(`SELECT fnBlotterIdGen() as blotterId`)
      )[0].blotterId;

      let [insert] = await transaction.query(
        `
        INSERT INTO brgy_blotters
        SET ?  
      `,
        [
          {
            blotterId: blotterId,
            ...rest,
            caseDetails: caseDetails,
            caseStatus: 0,
            dateCreated: date,
            dateUpdated: date,
          },
        ]
      );

      if (!insert.insertId) {
        throw {
          error: 500,
          message: "An error occurred. Please try again",
        };
      }

      let newComplainants = JSON.parse(complainants);
      let newRespondents = JSON.parse(respondents);
      for (let res of newComplainants) {
        let [insert] = await transaction.query(
          `
          INSERT INTO brgy_blotter_complainants
          SET ?  
        `,
          [
            {
              blotterId: blotterId,
              ...res,
              dateCreated: date,
              dateUpdated: date,
            },
          ]
        );

        if (!insert.insertId) {
          throw {
            error: 500,
            message: "An error occurred. Please try again",
          };
        }
      }

      for (let res of newRespondents) {
        let [insert] = await transaction.query(
          `
          INSERT INTO brgy_blotter_respondents
          SET ?  
        `,
          [
            {
              blotterId: blotterId,
              ...res,
              dateCreated: date,
              dateUpdated: date,
            },
          ]
        );

        if (!insert.insertId) {
          throw {
            error: 500,
            message: "An error occurred. Please try again",
          };
        }
      }

      await transaction.commit();
      await transaction.release();
      res.status(200).json({ message: "Added blotter successfully" });
    } catch (err) {
      await transaction.rollback();
      await transaction.release();
      next(err);
    }
  }

  async updateBlotter(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { blotterId } = req.params;
    let val = req.body;
    try {
      val.dateUpdated = date;

      let result = await req.db.query(
        `
        UPDATE brgy_blotters
        SET ?
        WHERE
          blotterId = ?
      `,
        [val, blotterId]
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

  async addBlotterStatement(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let val = { ...req.body };
    try {
      val.dateCreated = date;
      val.dateUpdated = date;

      let validate = await req.db.query(
        `
        SELECT * FROM
        brgy_blotters
        WHERE
          blotterId = ?
      `,
        val.blotterId
      );

      if (validate.length < 0) {
        return res.status(400).json({
          error: 400,
          message: `Blotter id is not existing in database.`,
        });
      }

      let result = await req.db.query(
        `
        INSERT INTO brgy_blotter_statements
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

  async addBlotterSummon(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let val = { ...req.body };
    let { blotterId } = req.params;
    let transaction;

    try {
      val.dateCreated = date;
      val.dateUpdated = date;
      val.blotterId = blotterId;
      let validate = await req.db.query(
        `
        SELECT * FROM
        brgy_blotters
        WHERE
          blotterId = ?
      `,
        blotterId
      );

      if (validate.length < 0) {
        return res.status(400).json({
          error: 400,
          message: `Blotter is not existing in database.`,
        });
      }

      let validateSummon = await req.db.query(
        `
        SELECT * FROM
        brgy_blotter_summons
        WHERE
          blotterId = ?
        ORDER BY id DESC
        LIMIT 1
      `,
        blotterId
      );

      if (validateSummon.length === 0) {
        val.caseStatus = 1;
      } else {
        if (validateSummon[0].status === 0) {
          return res.status(400).json({
            error: 400,
            message: "Failed to create summon letter due to ongoing summon.",
          });
        } else if (validateSummon[0].caseStatus > 3) {
          return res.status(400).json({
            error: 400,
            message:
              "Failed to create summon letter. You need to create CFA for this case",
          });
        }
        val.caseStatus = validateSummon[0].caseStatus + 1;
      }

      const summonId = (await req.db.query(`SELECT UUID() as summonId`))[0]
        .summonId;

      val.summonId = summonId;

      transaction = await req.db.getConnection();

      await transaction.beginTransaction();

      let [update] = await transaction.query(
        `
        UPDATE brgy_blotters
        SET ?
        WHERE
          blotterId = ?
      `,
        [
          {
            caseStatus: val.caseStatus,
            dateUpdated: val.dateUpdated,
          },
          blotterId,
        ]
      );

      if (!update.affectedRows) {
        throw {
          error: 500,
          message: "An error occurred. Please try again",
        };
      }

      let [insert] = await transaction.query(
        `
        INSERT INTO brgy_blotter_summons
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

      await transaction.commit();
      await transaction.release();
      res.status(200).json({ message: "Added blotter successfully" });
    } catch (err) {
      await transaction.rollback();
      await transaction.release();
      next(err);
    }
  }

  async settleBlotter(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { blotterId } = req.params;
    let val = { ...req.body };
    let transaction;

    try {
      val.dateCreated = date;
      val.dateUpdated = date;

      let validate = await req.db.query(
        `
        SELECT * FROM
        brgy_blotters
        WHERE
          blotterId = ?
      `,
        blotterId
      );

      if (validate.length < 0) {
        return res.status(400).json({
          error: 400,
          message: `Blotter id is not existing in database.`,
        });
      }

      let validateSettlement = await req.db.query(
        `
        SELECT * FROM
        brgy_blotter_settlements
        WHERE
          blotterId = ?
      `,
        blotterId
      );

      if (validateSettlement.length > 0) {
        return res.status(400).json({
          error: 400,
          message: `Blotter id is already settled.`,
        });
      }

      const settlementId = (
        await req.db.query(`SELECT UUID() as settlementId`)
      )[0].settlementId;

      val.settlementId = settlementId;

      transaction = await req.db.getConnection();

      await transaction.beginTransaction();

      let [update] = await transaction.query(
        `
        UPDATE brgy_blotters
        SET ?
        WHERE
          blotterId = ?
      `,
        [
          {
            caseStatus: 9,
            dateUpdated: val.dateUpdated,
          },
          blotterId,
        ]
      );

      if (!update.affectedRows) {
        throw {
          error: 500,
          message: "An error occurred. Please try again",
        };
      }

      val.blotterId = blotterId;

      let [insert] = await transaction.query(
        `
        INSERT INTO brgy_blotter_settlements
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

      await transaction.commit();
      await transaction.release();
      res.status(200).json({ message: "Added blotter successfully" });
    } catch (err) {
      await transaction.rollback();
      await transaction.release();
      next(err);
    }
  }

  async addAttendance(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { summonId } = req.params;
    let val = { ...req.body };
    let transaction;

    try {
      val.dateCreated = date;
      val.dateUpdated = date;

      let validate = await req.db.query(
        `
        SELECT * FROM
        brgy_blotter_summons
        WHERE
          summonId = ?
      `,
        summonId
      );

      if (validate.length === 0) {
        return res.status(400).json({
          error: 400,
          message: `Blotter id is not existing in database.`,
        });
      }

      let validateAttendance = await req.db.query(
        `
        SELECT * FROM
        brgy_blotter_attendances
        WHERE
          summonId = ? AND
          caseStatus = ?
      `,
        [summonId, validate[0].caseStatus]
      );

      if (validateAttendance.length > 0) {
        return res.status(400).json({
          error: 400,
          message: `Attendance is already exising.`,
        });
      }

      const attendanceId = (
        await req.db.query(`SELECT UUID() as attendanceId`)
      )[0].attendanceId;

      val.attendanceId = attendanceId;
      val.summonId = summonId;
      val.caseStatus = validate[0].caseStatus;

      transaction = await req.db.getConnection();

      await transaction.beginTransaction();

      let [update] = await transaction.query(
        `
        UPDATE brgy_blotter_summons
        SET ?
        WHERE
          summonId = ?
      `,
        [
          {
            status: 1,
            dateUpdated: val.dateUpdated,
          },
          summonId,
        ]
      );

      if (!update.affectedRows) {
        throw {
          error: 500,
          message: "An error occurred. Please try again",
        };
      }

      let [insert] = await transaction.query(
        `
        INSERT INTO brgy_blotter_attendances
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

      await transaction.commit();
      await transaction.release();
      res.status(200).json({ message: "Added attendance successfully" });
    } catch (err) {
      await transaction.rollback();
      await transaction.release();
      next(err);
    }
  }

  async addClauses(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { blotterId } = req.params;
    let val = { ...req.body };
    let transaction;

    try {
      val.dateCreated = date;
      val.dateUpdated = date;

      let validate = await req.db.query(
        `
          SELECT * FROM
          brgy_blotters
          WHERE
            blotterId = ?
        `,
        blotterId
      );

      if (validate.length < 0) {
        return res.status(400).json({
          error: 400,
          message: `Blotter id is not existing in database.`,
        });
      }

      transaction = await req.db.getConnection();

      await transaction.beginTransaction();

      let [update] = await transaction.query(
        `
          UPDATE brgy_blotters
          SET ?
          WHERE
            blotterId = ?
        `,
        [
          {
            caseStatus: 8,
            dateUpdated: val.dateUpdated,
          },
          blotterId,
        ]
      );

      if (!update.affectedRows) {
        throw {
          error: 500,
          message: "An error occurred. Please try again",
        };
      }

      val.blotterId = blotterId;
      const clauses = JSON.parse(val.clauses);
      delete val.clauses;

      for (const clause of clauses) {
        console.log(clause);
        let [insert] = await transaction.query(
          `
            INSERT INTO brgy_blotter_clauses
            SET ?
          `,
          [{ ...val, clause }]
        );

        if (!insert.insertId) {
          throw {
            error: 500,
            message: "An error occurred. Please try again",
          };
        }
      }

      await transaction.commit();
      await transaction.release();
      res.status(200).json({ message: "Added blotter successfully" });
    } catch (err) {
      await transaction.rollback();
      await transaction.release();
      next(err);
    }
  }

  async getBlotterTypes(req, res, next) {
    try {
      let result = await req.db.query(`
        SELECT 
          *
        FROM brgy_blotter_type
        WHERE 
          status = 0
      `);

      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async addBlotterType(req, res, next) {
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
        FROM brgy_blotter_type
        WHERE
          name = ? AND
          status = 0
      `,
        val.name.replace(/\s/g, "")
      );

      if (validate.length > 0) {
        return res.status(409).json({
          error: 409,
          message: "Blotter type is already existing.",
        });
      }

      let result = await req.db.query(
        `
        INSERT INTO brgy_blotter_type
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

  async updateBlotterType(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { id } = req.params;
    let val = req.body;
    try {
      val.dateUpdated = date;

      let result = await req.db.query(
        `
        UPDATE brgy_blotter_type
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

  async removeBlotterType(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { id } = req.params;
    let val = {};

    try {
      val.status = 1;
      val.dateUpdated = date;

      let result = await req.db.query(
        `
        UPDATE brgy_blotter_type
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

  async getClauses(req, res, next) {
    try {
      let result = await req.db.query(`
        SELECT 
          *
        FROM brgy_blotter_clauses_type
        WHERE 
          status = 0
      `);

      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async addClause(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    const { clause } = req.body;

    let val = {};
    try {
      val.clause = clause;
      val.status = 0;
      val.dateCreated = date;
      val.dateUpdated = date;

      let result = await req.db.query(
        `
        INSERT INTO brgy_blotter_clauses_type
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

  async updateClause(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { id } = req.params;
    let val = req.body;
    try {
      val.dateUpdated = date;

      let result = await req.db.query(
        `
        UPDATE brgy_blotter_clauses_type
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

  async removeClause(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { id } = req.params;
    let val = {};

    try {
      val.status = 1;
      val.dateUpdated = date;

      let result = await req.db.query(
        `
        UPDATE brgy_blotter_clauses_type
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
