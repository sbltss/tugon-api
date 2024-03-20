import lgus from "./lgu.json";

export default class Controller {
  async addMunicipalities(req, res, next) {
    try {
      const errList = [];
      for (const lgu of lgus) {
        let { id, ...newlgu } = lgu;

        const checkExist = await req.db.query(
          `
            SELECT *
            FROM
              municipalities
            WHERE
              lguCode= ?
          `,
          newlgu.lguCode
        );

        if (checkExist.length > 0) continue;

        const insertLgu = await req.db.query(
          `
            INSERT INTO
              municipalities
            SET ?
          `,
          { ...newlgu }
        );

        if (!insertLgu.insertId) {
          errList.push(newlgu.lguCode);
        }
      }

      return res.status(200).json({ message: "Lgus Inserted!", errList });
    } catch (err) {
      console.error(err);
      next(err);
    }
  }

  async fetchMunicipalities(req, res, next) {
    try {
      const municipalities = await req.db.query(
        `
        SELECT 
          lguCode, 
          lguName,
          cityCode,
          provCode,
          regCode
        FROM
          municipalities
      `
      );

      return res.status(200).json(municipalities);
    } catch (err) {
      console.error(err);
      next(err);
    }
  }
}
