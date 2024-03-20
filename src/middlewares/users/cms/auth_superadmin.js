import jwt from "jsonwebtoken";

export default async (req, res, next) => {
  const authorizationHeader = req.headers["authorization"];
  let token;
  let jwtSecret =
    process.env.NODE_ENV === "development"
      ? process.env.jwtSecretKey
      : process.env.jwtSecretKeyProd;

  if (authorizationHeader) {
    token = authorizationHeader.split(" ")[1];
  }
  if (!token)
    return res.status(401).json({ error: 401, message: "No token provided" });

  jwt.verify(token, jwtSecret, async (err, decoded) => {
    if (err) {
      res.status(401).json({
        error: 401,
        message: "Invalid authentication",
      });
    } else {
      const { accountId } = decoded;

      try {
        let result = await req.db.query(
          `
            SELECT * 
            FROM 
              credentials
            WHERE 
              accountId = ?
            `,
          [accountId]
        );

        const member = result[0];
        if (!member)
          return res.status(404).json({
            error: 404,
            message: "User does not exists.",
          });
        if (member.isDeleted == 1)
          return res.status(410).json({
            error: 410,
            message: "This account has been deleted",
          });

        if (member.accountType !== "superadmin")
          return res.status(403).json({
            error: 403,
            message: "You do not have access to this request.",
          });

        const result2 = await req.db.query(
          `SELECT *
                FROM superadmins
                WHERE 
                  accountId  = ?`,
          [member.accountId]
        );

        delete result2.password;
        delete result2.isDeleted;
        delete member.password;
        const memberInfo = result2[0];
        if (!memberInfo)
          return res.status(500).json({ message: "Internal Server Error" });

        req.currentUser = { ...member, ...memberInfo };
        next();
      } catch (err) {
        console.log("authentication error", err);
        next(err);
      }
    }
  });
};
