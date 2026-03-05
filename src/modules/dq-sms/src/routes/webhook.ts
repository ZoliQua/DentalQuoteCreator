import { FastifyInstance } from 'fastify'
import { prisma } from '../prisma.js'
import { validateTwilioSignature } from '../services/twilio.js'
import { config } from '../config.js'
import type { TwilioWebhookBody } from '../types.js'

export async function webhookRoutes(fastify: FastifyInstance) {
  // POST /webhook/twilio - Twilio delivery status callback
  fastify.post<{ Body: TwilioWebhookBody }>('/webhook/twilio', async (request, reply) => {
    // Validate Twilio signature if webhook URL is configured
    if (config.twilioWebhookUrl) {
      const signature = request.headers['x-twilio-signature'] as string
      if (!signature) {
        return reply.code(403).send({ error: 'Missing Twilio signature' })
      }

      const url = config.twilioWebhookUrl
      const isValid = validateTwilioSignature(url, request.body as any, signature)
      if (!isValid) {
        return reply.code(403).send({ error: 'Invalid Twilio signature' })
      }
    }

    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = request.body

    if (!MessageSid || !MessageStatus) {
      return reply.code(400).send({ error: 'Missing MessageSid or MessageStatus' })
    }

    // Find and update the SMS log by Twilio SID
    const existing = await prisma.smsLog.findFirst({
      where: { twilioSid: MessageSid },
    })

    if (!existing) {
      request.log.warn({ MessageSid }, 'Webhook received for unknown SMS')
      return reply.code(200).send({ ok: true })
    }

    await prisma.smsLog.update({
      where: { id: existing.id },
      data: {
        status: MessageStatus,
        errorCode: ErrorCode || existing.errorCode,
        errorMessage: ErrorMessage || existing.errorMessage,
      },
    })

    return reply.code(200).send({ ok: true })
  })
}
