function redactTokenUrl(value) {
  try {
    const url = new URL(value);
    if (url.searchParams.has('token')) url.searchParams.set('token', '[redacted]');
    return url.toString();
  } catch {
    return '[redacted]';
  }
}

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
      console.log(`[mail:email_verification] to=${to} verifyUrl=${redactTokenUrl(verifyUrl)}`);
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
      console.log(`[mail:password_reset] to=${to} resetUrl=${redactTokenUrl(resetUrl)}`);
      return message;
    },
  };
}
