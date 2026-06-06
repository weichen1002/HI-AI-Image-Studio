export function createConsoleMailer(config) {
  const sent = [];

  return {
    sent,
    async sendEmailVerification({ to, verifyUrl }) {
      const message = {
        type: 'email_verification',
        to,
        verifyUrl,
        createdAt: new Date().toISOString(),
      };
      sent.push(message);
      console.log(`[mail:email_verification] to=${to} verifyUrl=${verifyUrl}`);
      return message;
    },
    async sendPasswordReset({ to, resetUrl }) {
      const message = {
        type: 'password_reset',
        to,
        resetUrl,
        createdAt: new Date().toISOString(),
      };
      sent.push(message);
      console.log(`[mail:password_reset] to=${to} resetUrl=${resetUrl}`);
      return message;
    },
  };
}
