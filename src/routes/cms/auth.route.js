import express from "express";
import multer from "multer";
import fs from "fs";
import { check, body, oneOf } from "express-validator";
import Controller from "#cms_ctrl/auth.controller";
import brgyEmpAuth from "#middlewares/users/cms/auth_brgy_employee";
import validate from "#middlewares/validate";
import sanitizer from "#helpers/sanitizer";
import authUsers from "#middlewares/users/cms/auth_users.js";
const controller = new Controller();

var router = express.Router();

router.post(
  "/login",
  sanitizer,
  [
    check("email", "email is required").notEmpty(),
    check("password", "Password is required").notEmpty(),
  ],
  (req, res, next) => {
    validate(req, res, next);
  },
  controller.login
);

router.post(
  "/cpmsLogin",
  sanitizer,
  [
    check("username", "Username is required").notEmpty(),
    check("password", "Password is required").notEmpty(),
  ],
  (req, res, next) => {
    validate(req, res, next);
  },
  controller.cpmsLogin
);

router.post(
  "/brgyLogin",
  sanitizer,
  [
    check("username", "Username is required").notEmpty(),
    check("password", "Password is required").notEmpty(),
  ],
  (req, res, next) => {
    validate(req, res, next);
  },
  controller.brgyLogin
);

router.get(`/fetchMunicipalities`, controller.fetchMunicipalities);

router.post(
  `/changePasswordWithToken`,
  brgyEmpAuth,
  controller.changePasswordWithToken
);

router.post("/sendOtp", controller.sendOtp);

router.post("/submitOtp", controller.submitOtp);

router.post("/changePassword", controller.changePassword);

router.post(
  "/changePasswordAthenticated",
  authUsers,
  controller.changePasswordAthenticated
);

export default router;
