import express from "express";

import auth from "#citizen_route/auth.route";
import headProfile from "#citizen_route_head/profile.route";
import headTrace from "#citizen_route_head/trace.route";
import headCitizenso from "#citizen_route_head/citizenso.route";
import pwdServices from "#citizen_route_pwd/services.route";
import seniorServices from "#citizen_route_senior/services.route";
import upaoServices from "#citizen_route_upao/services.route";
import services from "#citizen_route_services/services.route";

import profile from "#citizen_route/profile/profile.route";
import cpms from "#citizen_route/cpms/cpms.route";

import token from "#middlewares/users/citizen/auth_citizen";
import userProfileAccess from "#middlewares/users/citizen/auth_citizen_cpms";
import userCpmsAccess from "#middlewares/users/citizen/auth_citizen_cpms";

var router = express.Router();
router.use("/auth", auth);
router.use("/profile", token, profile);
router.use("/module/cpms", token, userProfileAccess, userCpmsAccess, cpms);
router.use("/services/pwd", token, pwdServices);
router.use("/services/senior", token, seniorServices);
router.use("/services/upao", token, upaoServices);
router.use("/services", token, services);

router.use("/head/profile", token, headProfile);
router.use("/head/trace", token, headTrace);
router.use("/head/cpms", token, headCitizenso);

export default router;
