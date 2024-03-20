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
  if (token) {
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
            `SELECT * 
            FROM cms_accounts
            WHERE accountId = ?`,
            [accountId]
          );
          
          const member = result[0];
          console.log(member)
          if (!member) {
            res.status(404).json({
              error: 404,
              message: "User does not exists.",
            });
          } else if (member.isDeleted == 1) {
            res.status(410).json({
              error: 410,
              message: "This account has been deleted",
            });
          } else {
            req.currentUser = JSON.parse(JSON.stringify(member));
            next();
          }
        } catch (err) {
          console.log('authentication error',err)
          next(err);
        }
      }
    });
  } else {
    res.status(401).json({ error: 401, message: "No token provided" });
  }
};
