import Twilio from 'twilio'
import { config } from '../config.js'
import { prisma } from '../prisma.js'

const client = Twilio(config.twilioAccountSid, config.twilioAuthToken)

interface SendSmsParams {
  to: string
  message: string
  patientId?: string
  patientName?: string
  context?: string
  templateId?: string
}

export async function sendSms(params: SendSmsParams) {
  const { to, message, patientId, patientName, context, templateId } = params

  // Create SmsLog entry with pending status
  const smsLog = await prisma.smsLog.create({
    data: {
      toNumber: to,
      fromNumber: config.twilioPhoneNumber,
      message,
      templateId,
      status: 'pending',
      patientId,
      patientName,
      context,
    },
  })

  try {
    const twilioMessage = await client.messages.create({
      body: message,
      from: config.twilioPhoneNumber,
      to,
      statusCallback: config.twilioWebhookUrl || undefined,
    })

    // Update with Twilio SID and status
    const updated = await prisma.smsLog.update({
      where: { id: smsLog.id },
      data: {
        twilioSid: twilioMessage.sid,
        status: twilioMessage.status,
      },
    })

    return updated
  } catch (error: any) {
    // Update log with error
    const updated = await prisma.smsLog.update({
      where: { id: smsLog.id },
      data: {
        status: 'failed',
        errorCode: error.code?.toString() || 'UNKNOWN',
        errorMessage: error.message || 'Unknown error',
      },
    })

    throw { smsLog: updated, error }
  }
}

export function validateTwilioSignature(url: string, params: Record<string, string>, signature: string): boolean {
  return Twilio.validateRequest(config.twilioAuthToken, signature, url, params)
}
