export const registrationLogs = (db, fields) =>
  new Promise(async (resolve, reject) => {
    try {
      const insertLogs = await db.query(
        `
        INSERT INTO
          registration_logs
        SET ?
      `,
        fields
      );
      resolve(insertLogs);
    } catch (err) {
      reject(err);
    }
  });
