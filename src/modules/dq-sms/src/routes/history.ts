import { FastifyInstance } from 'fastify'
import { prisma } from '../prisma.js'
import type { SmsHistoryQuery } from '../types.js'

export async function historyRoutes(fastify: FastifyInstance) {
  // GET /sms/history - SMS history with filters
  fastify.get<{ Querystring: SmsHistoryQuery }>('/sms/history', async (request, reply) => {
    const { patientId, status, from, to, limit, offset } = request.query

    const where: any = {}
    if (patientId) where.patientId = patientId
    if (status) where.status = status
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) where.createdAt.lte = new Date(to)
    }

    const take = Math.min(parseInt(limit || '50', 10), 200)
    const skip = parseInt(offset || '0', 10)

    const [logs, total] = await Promise.all([
      prisma.smsLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.smsLog.count({ where }),
    ])

    return reply.send({ logs, total, limit: take, offset: skip })
  })

  // GET /sms/history/:id - Single SMS detail
  fastify.get<{ Params: { id: string } }>('/sms/history/:id', async (request, reply) => {
    const { id } = request.params

    const log = await prisma.smsLog.findUnique({ where: { id } })

    if (!log) {
      return reply.code(404).send({ error: 'SMS log not found' })
    }

    return reply.send(log)
  })
}
