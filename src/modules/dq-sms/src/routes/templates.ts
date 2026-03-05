import { FastifyInstance } from 'fastify'
import { getTemplates } from '../services/templates.js'

export async function templateRoutes(fastify: FastifyInstance) {
  // GET /sms/templates - List available SMS templates
  fastify.get('/sms/templates', async (_request, reply) => {
    const templates = getTemplates()
    return reply.send({ templates })
  })
}
