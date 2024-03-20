import axios from "axios";

const apiKey = `${process.env.otpApiKey}`;
const apiSecret = `${process.env.otpApiSecret}`;
const apiKeyReg = `${process.env.otpApiKeyReg}`;
const from = `TRACETAGUIG`;
let basicAuth = `${process.env.otpApiBasicAuth}`;

export default class OTP {
  async otpRequest(mobile, val) {
    // let val = Math.floor(1000 + Math.random() * 9000);
    // let val = 1111;
    let msg = `Your TRACE code is ${val}. Enter this code to confirm your request within 2 minutes. For your protection,please do not share this code with anyone. Thank you.`;

    let uri = encodeURIComponent(msg);
    let getXmlValue = (str, key) => {
      return str.substring(
        str.lastIndexOf("<" + key + ">") + ("<" + key + ">").length,
        str.lastIndexOf("</" + key + ">")
      );
    };
    return await axios({
      url: `https://messagingsuite.smart.com.ph/cgphttp/servlet/sendmsg?destination=${mobile}&source=TAGUIGTRACE&responseType=1&text=${uri}`,
      type: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        Authorization: `Basic ${basicAuth}`,
      },
    }).then((response) => {
      let status = getXmlValue(response.data, "response_string");
      let id = getXmlValue(response.data, "message_id");
      let obj = {
        status: status.toLowerCase(),
        data: {
          id: id,
          code: val,
        },
      };
      return obj;
    });
  }
}
