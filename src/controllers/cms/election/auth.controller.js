import moment from "moment";
import mtz from "moment-timezone";
import randomize from "randomatic";
import hash from "#helpers/hash";
import global from "#helpers/global";
import { isEmpty } from "lodash";

import audit from "#helpers/audit";
import unlinkFiles from "#helpers/unlinkfiles";

export default class Controller {
  async getCitizenRecord(req, res, next) {
    const { firstName, lastName, regionId, cityId, brgyId, page, page_size } =
      req.body;
    try {
      const offset = page_size * page - page_size;

      const [count] = await req.db.query(`
        SELECT
          COUNT(id) as size
        FROM citizen_info
      `);

      let result = await req.db.query(
        `
        SELECT
          CI.accountId,
          CI.firstName,
          CI.middleName,
          CI.lastName,
          CI.suffix,
          CC.primaryEmail,
          CC.primaryMobile,
          CI.birthdate,
          CI.sex
          FROM citizen_info CI
          LEFT JOIN registration_logs RL USING (accountId)
          LEFT JOIN citizen_contacts CC USING (accountId)
          WHERE
            CI.isDeleted = 0 AND
            CI.firstName LIKE ? AND
            CI.lastName LIKE ? AND 
            RL.regionId LIKE ? AND
            RL.cityId LIKE ? AND
            RL.brgyId LIKE ?
          LIMIT ?, ?
        `,
        [
          `${firstName || ""}%`,
          `${lastName || ""}%`,
          `${regionId || ""}%`,
          `${cityId || ""}%`,
          `${brgyId || ""}%`,
          offset,
          +page_size,
        ]
      );

      const data = {
        page: page,
        page_size: page_size,
        number_of_pages: Math.ceil(count.size / page_size),
        data: result,
      };
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }
}
