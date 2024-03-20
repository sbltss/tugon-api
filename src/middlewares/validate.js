import { validationResult } from "express-validator";

export default (req, res, next) => {
  let errors = validationResult(req);
  if (!errors.isEmpty()) {
    // return res.status(400).json({ message: 'Invalid parameters', stack: errors.array().map(obj => { return obj.msg }) })
    let error = errors.array({ onlyFirstError: true });

    return res.status(400).json({
      message: error[0].msg,
      stack: errors.array({ onlyFirstError: true }),
    });
  } else {
    next();
  }
};
