export default async (req, res, next) => {
  const { accountId } = req.currentUser;
  let module = ["CPMS","CBMS","CVMS"]
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
  console.log(result)
  if (result.length == 0) {
    return res.status(401).json({
      error: 401,
      message: `Citizen access not available application not yet approved.`,
    });
  } else {
    next();
  }
}