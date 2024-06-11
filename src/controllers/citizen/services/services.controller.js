import moment from "moment";
import mtz from "moment-timezone";
import randomize from "randomatic";
import hash from "#helpers/hash";
import global from "#helpers/global";
import { isEmpty } from "lodash";

import audit from "#helpers/audit";
import unlinkFiles from "#helpers/unlinkfiles";

export default class Controller {
  async getIdStatus(req, res, next) {
    let { accountId } = req.currentUser;

    try {
      let result = await req.db.query(
        `
        SELECT 
          sectorId,
          status
        FROM citizen_sectors 
        WHERE 
          accountId = ?
      `,
        accountId
      );
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
