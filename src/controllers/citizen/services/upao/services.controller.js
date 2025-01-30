import moment from "moment";
import mtz from "moment-timezone";
import randomize from "randomatic";
import hash from "#helpers/hash";
import global from "#helpers/global";
import { isEmpty } from "lodash";

import audit from "#helpers/audit";
import unlinkFiles from "#helpers/unlinkfiles";

export default class Controller {
  async createSocioEconomic(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { accountId } = req.currentUser;
    let {
      familyMember,
      upaoId,
      electricity,
      water,
      food,
      education,
      otherExpenses,
      amortization,
      carLoan,
      houseLoan,
      monthlyDues,
      totalMonthlyExpenses,
      netIncome,
      houseStatus,
      lengthOfStay,
      houseDesc,
      cr,
      ...rest
    } = req.body;

    let transaction;
    try {
      let validate = await req.db.query(
        `
        SELECT *
        FROM citizen_info
        WHERE
          accountId = ?
        `,
        accountId
      );

      if (validate.length === 0) {
        return res.status(404).json({ message: "Account is not found" });
      }

      let checkUpaoInfo = await req.db.query(
        `
        SELECT *
        FROM citizen_upao_info
        JOIN citizen_expenditures ON citizen_upao_info.accountId = citizen_expenditures.accountId
        WHERE
          citizen_upao_info.accountId = ?
      `,
        accountId
      );

      if (checkUpaoInfo.length > 0) {
        return res
          .status(409)
          .json({ message: "You've already register in Socio Economic" });
      }

      transaction = await req.db.getConnection();

      await transaction.beginTransaction();

      // let icn = files.document[0].path;
      let [genUUID] = await transaction.query(`SELECT UUID() AS uuid`);
      const { uuid } = genUUID[0];
      // let [genSeniorUUID] = await transaction.query(
      //   `SELECT UUID() AS seniorUuid`
      // );
      // const { seniorUuid } = genSeniorUUID[0];

      let [insertInfo] = await transaction.query(
        `
        INSERT INTO citizen_upao_info
        SET ?  
      `,
        [
          {
            accountId: accountId,
            upaoId: uuid,
            ...rest,
            familyMember: JSON.stringify(familyMember),
            dateCreated: date,
            dateUpdated: date,
          },
        ]
      );

      if (insertInfo.affectedRows === 0) {
        throw {
          error: 500,
          message: "An error occurred. Please try again",
        };
      }

      const expenditures = {
        accountId: accountId,
        electricity,
        water,
        food,
        education,
        otherExpenses,
        amortization,
        carLoan,
        houseLoan,
        monthlyDues,
        totalMonthlyExpenses,
        netIncome,
        houseStatus,
        lengthOfStay,
        houseDesc,
        cr,
      };

      let [insertExpenditures] = await transaction.query(
        `
        INSERT INTO citizen_expenditures
        SET ? 
      `,
        expenditures
      );

      if (insertExpenditures.affectedRows === 0) {
        throw {
          error: 500,
          message: "An error occurred. Please try again",
        };
      }

      let auditObj = {
        createdBy: accountId,
        accountId: accountId,
        userPriviledge: `CITIZEN`,
        actionType: "REGISTER SOCIO ECONOMIC",
        crud: "CREATE",
        newValue: JSON.stringify({ body: req.body, files: req.files }),
        dateCreated: date,
        dateUpdated: date,
      };

      await audit.auditData(req, auditObj);

      await transaction.commit();
      await transaction.release();
      return res
        .status(200)
        .json({ message: "You've successfully register for Socio Economic" });
    } catch (err) {
      console.log(err);
      // unlinkFiles.unlinkProfileFiles(req.files);
      await transaction.rollback();
      await transaction.release();
      next(err);
    }
  }
}
