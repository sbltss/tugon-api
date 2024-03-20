import express from "express";
import multer from "multer";
import fs from "fs";
import qs from "qs";
import axios from "axios";
import { check, body, oneOf } from "express-validator";
import Controller from "#citizen_ctrl/auth.controller";

import validate from "#middlewares/validate";
import sanitizer from "#helpers/sanitizer";
const controller = new Controller();

var router = express.Router();
router.get("/getBrgy", controller.getBrgy);
router.post(
  "/login",
  sanitizer,
  [
    check("username", "Username is required").notEmpty(),
    check("password", "Password is required").notEmpty(),
  ],
  (req, res, next) => {
    validate(req, res, next);
  },
  controller.login
);

router.post(
  "/signupCitizen",
  sanitizer,
  [
    check("firstName", "First name is required").notEmpty(),
    check("lastName", "Last name is required").notEmpty(),
    check("birthdate", "Birthday is required").notEmpty(),
    check("mobileNumber")
      .if(body("mobileNumber").exists())
      .notEmpty()
      .withMessage("Mobile number is required")
      .isLength({ min: 12, max: 12 })
      .withMessage("Mobile number must have a length of 12 digit number"),
    check("username")
      .notEmpty()
      .withMessage("Username is required")
      .isLength({ min: 5, max: 30 })
      .withMessage(
        "Username must have a minimum length of 5 & maximum length of 30"
      ),
    check("password")
      .notEmpty()
      .withMessage("Password is required")
      .isLength({ min: 5, max: 30 })
      .withMessage(
        "Password must have a minimum length of 5 & maximum length of 30"
      ),
  ],
  (req, res, next) => {
    validate(req, res, next);
  },
  controller.signupvaliditor,
  controller.signupCitizen
);

router.post(
  "/requestCode",
  sanitizer,
  [
    check("email")
      .if(body("email").exists())
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Invalid email"),
    check("mobileNumber")
      .if(body("mobileNumber").exists())
      .notEmpty()
      .withMessage("Mobile number is required")
      .isLength({ min: 12, max: 12 })
      .withMessage("Mobile number must have a length of 12 digit number"),
    oneOf([body("email").exists(), body("mobileNumber").exists()]),
  ],
  (req, res, next) => {
    validate(req, res, next);
  },
  controller.requestCode
);

router.post(
  "/validateCode",
  sanitizer,
  [
    check("token", "Token is required").notEmpty(),
    check("code", "Code is required").notEmpty(),
  ],
  (req, res, next) => {
    validate(req, res, next);
  },
  controller.validateCode
);

router.post(
  "/resetPassword",
  sanitizer,
  [
    check("token", "Token is required").notEmpty(),
    check("uId", "ID is required").notEmpty(),
    check("password")
      .notEmpty()
      .withMessage("Password is required")
      .isLength({ min: 5, max: 30 })
      .withMessage(
        "Password must have a minimum length of 5 & maximum length of 30"
      ),
  ],
  (req, res, next) => {
    validate(req, res, next);
  },
  controller.resetPassword
);

router.post("/genkey", controller.genKey);
router.post("/addBrgy", controller.addBrgy);
router.post("/addAddress", controller.addAddress);

router.post(
  "/traceLogin",
  async (req, res, next) => {
    let traceUrl = `${process.env.API_TRACEURL_PROD}/api/web/data/newLogin`;
    try {
      let userData = await axios.request({
        method: "POST",
        url: traceUrl,
        data: qs.stringify(req.body),
      });
      if (Object.keys(userData.data).length > 0) {
        req.body = userData.data.data;
        next();
      } else {
        return res.status(403).json({ error: 403, message: `No data found` });
      }
    } catch (err) {
      return res.status(403).json({ error: 403, message: `No data found` });
    }
  },
  controller.loginTraceCitizen
);

router.get(`/fetchMunicipalities`, controller.fetchMunicipalities);

export default router;
