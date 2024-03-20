export default async (req, res, next) => {
  const { accountId } = req.currentUser;
  let module = ["PROFILE"]
  let result = await req.db.query(
    `
    SELECT * 
    FROM citizen_verifystatus
    WHERE
      services IN ("${module.join("\",\"")}") AND
      accountId = ? AND
      status = ?

  `,
    [accountId,"APPROVED"]
  );
  if (result.length == 0) {
    return res.status(401).json({
      error: 401,
      message: `Please make sure to verify your account first.`,
    });
  } else {
    next();
  }
}