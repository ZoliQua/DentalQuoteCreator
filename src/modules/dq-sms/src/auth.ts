import { FastifyRequest, FastifyReply } from 'fastify'
import { config } from './config.js'

export async function apiKeyAuth(request: FastifyRequest, reply: FastifyReply) {
  const apiKey = request.headers['x-api-key']

  if (!apiKey || apiKey !== config.smsApiKey) {
    reply.code(401).send({ error: 'Unauthorized: Invalid or missing API key' })
  }
}
