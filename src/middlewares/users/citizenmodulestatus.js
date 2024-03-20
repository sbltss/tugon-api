import unlinkFiles from "#helpers/unlinkfiles";

export default async (req, res, next) => {
  const { accountId } = req.currentUser;
  const { module } = req.body;
  let result = await req.db.query(
    `
    SELECT * 
    FROM citizen_verifystatus
    WHERE
      services = ? AND
      accountId = ?
  `,
    [module, accountId]
  );
  if (result.length == 0) {
    unlinkFiles.unlinkProfileFiles(req.files);
    res.status(401).json({
      error: 401,
      message: `Citizen access not available.`,
    });
  } else {
    if (result[0].status === "VERIFIED") {
      unlinkFiles.unlinkProfileFiles(req.files);
      res.status(401).json({
        error: 401,
        message: `Access failed. Account already verified.`,
      });
    } else {
      next();
    }
  }
};
