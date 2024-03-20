import mtz from "moment-timezone";
import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.sendgridApiKeyOtp);

export const emailNewReg = (email, username, defaultPassword) => {
  return new Promise(async (resolve, reject) => {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let msg = `
    <!DOCTYPE html>
    <html>
    <body>

      <div  style="font-size:16px;line-height:24px;text-align:left">
      <p>Your username is: <b>${username}</b> </p>
      <p>Your default password is: <b>${defaultPassword}</b> </p>
      <p style="margin-top: 1.5rem;">For security, we recommend you to immediately change your password upon first login.</p>
        <p>For assistance regarding your inquiries related to the event, please feel free to email us at <a href="info@digitalgovernmentsolutions.com">info@digitalgovernmentsolutions.com<a>.</p>

        <p>
            <span style="display: block;">Thank you,</span>
            <span style="display: block;">Digital Government Solutions Team</span>
        </p>
        <p style="font-size:12px;line-height:24px;font-style: italic;text-align:center;">
            This is a system generated message. Please DO NOT REPLY to this email. ${date} 
        </p>
      </div>
    </body>
    </html>
    `;
    try {
      await sgMail.send({
        to: email,
        from: {
          email: process.env.DGS_SENDER_EMAIL,
          name: process.env.DGS_SENDER_NAME,
        },
        subject: "DGS Registration",
        html: msg,
      });
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

export const emailForgotPass = (email, pin) => {
  return new Promise(async (resolve, reject) => {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let msg = `
    <!DOCTYPE html>
    <html>
    <body>

      <div  style="font-size:16px;line-height:24px;text-align:left">
        <p>Your code is. <b>${pin}</b> </p>
        <p style="margin-top: 1.5rem;">Kindly enter this code to confirm your request within 5 minutes. For your protection, please do not share this code to anyone.</p>
        <p>For assistance regarding your inquiries related to the event, please feel free to email us at <a href="info@digitalgovernmentsolutions.com">info@digitalgovernmentsolutions.com<a>.</p>

        <p>
            <span style="display: block;">Thank you,</span>
            <span style="display: block;">Digital Government Solutions Team</span>
        </p>
        <p style="font-size:12px;line-height:24px;font-style: italic;text-align:center;">
            This is a system generated message. Please DO NOT REPLY to this email. ${date} 
        </p>
      </div>
    </body>
    </html>
    `;
    try {
      await sgMail.send({
        to: email,
        from: {
          email: process.env.DGS_SENDER_EMAIL,
          name: process.env.DGS_SENDER_NAME,
        },
        subject: "DGS Account Password Reset",
        html: msg,
      });
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

export const emailRegistration = (email, pin) => {
  return new Promise(async (resolve, reject) => {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let msg = `
    <!DOCTYPE html>
    <html>
    <body>

      <div  style="font-size:16px;line-height:24px;text-align:left">
        <p>Your code is. <b>${pin}</b> </p>
        <p style="margin-top: 1.5rem;">Kindly enter this code to continue your registration request within 2 minutes. For your protection, please do not share this code to anyone.</p>
        <p>For assistance regarding your inquiries related to the event, please feel free to email us at <a href="inquire@defensys.com">inquire@defensys.com<a> or contact us at 9999 9999.</p>

        <p>
            <span style="display: block;">Thank you,</span>
            <span style="display: block;">Defensys Team</span>
        </p>
        <p style="font-size:12px;line-height:24px;font-style: italic;text-align:center;">
            This is a system generated message. Please DO NOT REPLY to this email. ${date} 
        </p>
      </div>
    </body>
    </html>
    `;
    try {
      await sgMail.send({
        to: email,
        from: {
          email: process.env.SENDER_EMAIL,
          name: process.env.SENDER_NAME,
        },
        subject: "Defensys Registration",
        html: msg,
      });
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

//CITIZEN
export const citizenEmailForgotPass = (email, username, firstName, pin) => {
  return new Promise(async (resolve, reject) => {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let msg = `
    <!DOCTYPE html>
    <html>
    <body>

      <div  style="font-size:16px;line-height:24px;text-align:left">
        <p>Dear ${firstName},</p>
        <p style="margin-top: 1.5rem;">Your username is: <b>${username}</b> </p>
        <p style="margin-top: 1.5rem;">Your code is: <b>${pin}</b> </p>
        <p style="margin-top: 1.5rem;">Kindly enter this code to confirm your request within 5 minutes. For your protection, please do not share this code to anyone.</p>
        <p>For assistance regarding your inquiries related to the event, please feel free to email us at <a href="info@digitalgovernmentsolutions.com">info@digitalgovernmentsolutions.com<a>.</p>

        <p>
            <span style="display: block;">Thank you,</span>
            <span style="display: block;">Digital Government Solutions Team</span>
        </p>
        <p style="font-size:12px;line-height:24px;font-style: italic;text-align:center;">
            This is a system generated message. Please DO NOT REPLY to this email. ${date} 
        </p>
      </div>
    </body>
    </html>
    `;
    try {
      await sgMail.send({
        to: email,
        from: {
          email: process.env.DGS_SENDER_EMAIL,
          name: process.env.DGS_SENDER_NAME,
        },
        subject: "DGS Account Password Reset",
        html: msg,
      });
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};
