import moment from "moment";
import mtz from "moment-timezone";

let auditData = async (req, data) => {
  let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");

  let result = await req.db.query(
    `
    INSERT INTO audittrail
    SET ?
  `,
    data
  );
  return result;
};

export default {
  auditData,
};
