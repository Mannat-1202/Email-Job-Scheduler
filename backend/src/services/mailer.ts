import nodemailer from 'nodemailer';
import { db } from '../db/client';

export interface SendMailOptions {
  to: string;
  subject: string;
  body: string;
}

export interface SendMailResult {
  messageId: string;
  previewUrl: string | false;
}

export async function provisionSender(userId: string, customEmail?: string) {
  const testAccount = await nodemailer.createTestAccount();

  const sender = await db.sender.create({
    data: {
      userId,
      email: customEmail || testAccount.user,
      smtpHost: testAccount.smtp.host,
      smtpPort: testAccount.smtp.port,
      smtpUser: testAccount.user,
      smtpPass: testAccount.pass,
    },
  });

  return sender;
}

export async function sendEmail(senderId: string, options: SendMailOptions): Promise<SendMailResult> {
  const sender = await db.sender.findUnique({
    where: { id: senderId },
  });

  if (!sender) {
    throw new Error(`Sender with id ${senderId} not found`);
  }

  const transporter = nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: sender.smtpPort === 465,
    auth: {
      user: sender.smtpUser,
      pass: sender.smtpPass,
    },
  });

  const info = await transporter.sendMail({
    from: `"ReachInbox Sender" <${sender.email}>`,
    to: options.to,
    subject: options.subject,
    text: options.body,
    html: `<div>${options.body.replace(/\n/g, '<br/>')}</div>`,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`[Mailer] Ethereal preview URL: ${previewUrl}`);
  }

  return {
    messageId: info.messageId,
    previewUrl,
  };
}

export const mailer = {
  provisionSender,
  sendEmail,
};
