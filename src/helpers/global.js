import moment from "moment";
import mtz from "moment-timezone";
import uniqid from "uniqid";

const generateUUID = async () => {
  return (
    moment().year() + uniqid.time().toUpperCase() + moment().format("MMDD")
  );
};
const isEmpty = (value) =>
  value === null || value === "" || value === undefined;

export default {
  generateUUID,
  isEmpty,
};
