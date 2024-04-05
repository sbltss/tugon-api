import express from "express";

import auth from "#cms_route/auth.route";

//BRGY
import brgyAdmin from "#cms_route/brgy/admin.route";
import brgyClearance from "#cms_route/brgy/clearance.route";
import brgyCert from "#cms_route/brgy/certification.route";
import brgyCedula from "#cms_route/brgy/cedula.route";
import brgyBrgyId from "#cms_route/brgy/brgyid.route";
import brgyCitizen from "#cms_route/brgy/citizen.route";
import brgyEvent from "#cms_route/brgy/events.route";
import brgyDashboard from "#cms_route/brgy/dashboard.route";
import brgyBlotter from "#cms_route/brgy/blotter.route";
import brgyEstablishment from "#cms_route/brgy/establishment.route";

//DEPT
import deptAdmin from "#cms_route/dept/admin.route";
import deptCitizen from "#cms_route/dept/citizen.route";
import deptDashboard from "#cms_route/dept/dashboard.route";
import deptSeniorId from "#cms_route/dept/seniorid.route";
import deptCertification from "#cms_route/dept/certification.route";

//CPMS
import employee from "#cms_route/cpms/employee.route";
import enumerator from "#cms_route/cpms/enumerator.route";

//ADMIN
import admin from "#cms_route/admin/admin.route";
import adminSector from "#cms_route/admin/sector.route";
import adminCpms from "#cms_route/admin/cpms.route";
import adminPanel from "#cms_route/admin/dashboard.route";

//SUPERADMIN
import superadmin from "#cms_route/superadmin/superadmin.route";
import superadminSector from "#cms_route/superadmin/sector.route";
import superpadminFn from "#cms_route/superadmin/admin.route";
import superadminDashboard from "#cms_route/superadmin/dashboard.route";

import brgyEmpAuth from "#middlewares/users/cms/auth_brgy_employee";
import deptEmpAuth from "#middlewares/users/cms/auth_dept_employee";
import employeeAuth from "#middlewares/users/cms/auth_cpms_employee";
import enumeratorAuth from "#middlewares/users/cms/auth_cpms_enumerator";
import adminAuth from "#middlewares/users/cms/auth_admin";
import superadminAuth from "#middlewares/users/cms/auth_superadmin";

//ELECTION
import election from "#cms_route/election/election.route";

var router = express.Router();

router.use("/auth", auth);

//BRGY
router.use("/brgy/admin", brgyEmpAuth, brgyAdmin);
router.use("/brgy/clearance", brgyEmpAuth, brgyClearance);
router.use("/brgy/cert", brgyEmpAuth, brgyCert);
router.use("/brgy/cedula", brgyEmpAuth, brgyCedula);
router.use("/brgy/brgyId", brgyEmpAuth, brgyBrgyId);
router.use("/brgy/citizen", brgyEmpAuth, brgyCitizen);
router.use("/brgy/events", brgyEmpAuth, brgyEvent);
router.use("/brgy/dashboard", brgyEmpAuth, brgyDashboard);
router.use("/brgy/blotter", brgyEmpAuth, brgyBlotter);
router.use("/brgy/establishment", brgyEmpAuth, brgyEstablishment);

//DEPT
router.use("/dept/admin", deptEmpAuth, deptAdmin);
router.use("/dept/citizen", deptEmpAuth, deptCitizen);
router.use("/dept/dashboard", deptEmpAuth, deptDashboard);
router.use("/dept/seniorId", deptEmpAuth, deptSeniorId);
router.use("/dept/certification", deptEmpAuth, deptCertification);

//CPMS
router.use("/cpms/employee", employeeAuth, employee);
router.use("/cpms/enumerator", enumeratorAuth, enumerator);

//ADMIN
router.use("/admin/fn", adminAuth, admin);
router.use("/admin/sector", adminAuth, adminSector);
router.use("/admin/cpms", adminAuth, adminCpms);
router.use("/admin/panel", adminAuth, adminPanel);

//SUPERADMIN
router.use("/superadmin", superadminAuth, superadmin);
router.use("/superadmin/sector", superadminAuth, superadminSector);
router.use("/superadmin/fn", superadminAuth, superpadminFn);
router.use("/superadmin/dashboard", superadminAuth, superadminDashboard);

//ELECTION
router.use("/election", election);

export default router;
