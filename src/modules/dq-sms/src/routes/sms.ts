import { FastifyInstance } from 'fastify'
import { normalizePhoneNumber, isValidE164 } from '../services/phone.js'
import { getTemplateById, renderTemplate } from '../services/templates.js'
import { sendSms } from '../services/twilio.js'
import type { SendSmsBody, SendTemplateSmsBody } from '../types.js'

export async function smsRoutes(fastify: FastifyInstance) {
  // POST /sms/send - Free-text SMS
  fastify.post<{ Body: SendSmsBody }>('/sms/send', async (request, reply) => {
    const { to, message, patientId, patientName, context, isHungarian } = request.body

    if (!to || !message) {
      return reply.code(400).send({ error: 'Missing required fields: to, message' })
    }

    if (message.length > 1600) {
      return reply.code(400).send({ error: 'Message too long (max 1600 characters)' })
    }

    let normalizedPhone: string
    try {
      normalizedPhone = normalizePhoneNumber(to, isHungarian ?? true)
    } catch {
      return reply.code(400).send({ error: `Invalid phone number: ${to}` })
    }

    if (!isValidE164(normalizedPhone)) {
      return reply.code(400).send({ error: `Invalid E.164 phone number: ${normalizedPhone}` })
    }

    try {
      const smsLog = await sendSms({
        to: normalizedPhone,
        message,
        patientId,
        patientName,
        context,
      })

      return reply.code(200).send({
        success: true,
        smsId: smsLog.id,
        twilioSid: smsLog.twilioSid,
        status: smsLog.status,
      })
    } catch (err: any) {
      const smsLog = err.smsLog
      request.log.error(err.error, 'SMS send failed')
      return reply.code(500).send({
        success: false,
        smsId: smsLog?.id,
        error: err.error?.message || 'SMS send failed',
      })
    }
  })

  // POST /sms/send-template - Template-based SMS
  fastify.post<{ Body: SendTemplateSmsBody }>('/sms/send-template', async (request, reply) => {
    const { to, templateId, variables, patientId, patientName, context, isHungarian } = request.body

    if (!to || !templateId || !variables) {
      return reply.code(400).send({ error: 'Missing required fields: to, templateId, variables' })
    }

    const template = getTemplateById(templateId)
    if (!template) {
      return reply.code(400).send({ error: `Unknown template: ${templateId}` })
    }

    let message: string
    try {
      message = renderTemplate(template, variables)
    } catch (err: any) {
      return reply.code(400).send({ error: err.message })
    }

    let normalizedPhone: string
    try {
      normalizedPhone = normalizePhoneNumber(to, isHungarian ?? true)
    } catch {
      return reply.code(400).send({ error: `Invalid phone number: ${to}` })
    }

    if (!isValidE164(normalizedPhone)) {
      return reply.code(400).send({ error: `Invalid E.164 phone number: ${normalizedPhone}` })
    }

    try {
      const smsLog = await sendSms({
        to: normalizedPhone,
        message,
        patientId,
        patientName,
        context,
        templateId,
      })

      return reply.code(200).send({
        success: true,
        smsId: smsLog.id,
        twilioSid: smsLog.twilioSid,
        status: smsLog.status,
        renderedMessage: message,
      })
    } catch (err: any) {
      const smsLog = err.smsLog
      request.log.error(err.error, 'Template SMS send failed')
      return reply.code(500).send({
        success: false,
        smsId: smsLog?.id,
        error: err.error?.message || 'SMS send failed',
      })
    }
  })
}
