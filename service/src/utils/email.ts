import * as nodemailer from 'nodemailer'

export function sendEmail(subject: string, content: string, destinationEmail: string): void {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'puzzledgrass@gmail.com',
      pass: 'nkhbzssjuakibyhs',
    },
  })

  const mailOptions = {
    from: 'puzzledgrass@gmail.com',
    to: destinationEmail,
    subject,
    text: content,
  }

  transporter.sendMail(mailOptions, (error, info) => {
    if (error)
      globalThis.console.log(`Error occurred: ${error.message}`)
    else
      globalThis.console.log(`Message sent: ${info.response}`)
  })
}
