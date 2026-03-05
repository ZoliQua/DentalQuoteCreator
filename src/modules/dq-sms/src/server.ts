import 'dotenv/config'
import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'
import { config } from './config.js'
import { prisma } from './prisma.js'
import { apiKeyAuth } from './auth.js'
import { smsRoutes } from './routes/sms.js'
import { templateRoutes } from './routes/templates.js'
import { historyRoutes } from './routes/history.js'
import { webhookRoutes } from './routes/webhook.js'

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  },
})

async function start() {
  // Rate limiting for SMS send endpoints
  await fastify.register(rateLimit, {
    max: 20,
    timeWindow: '1 minute',
    keyGenerator: () => 'global',
    allowList: [],
    hook: 'onRequest',
    addHeadersOnExceeding: { 'x-ratelimit-limit': true, 'x-ratelimit-remaining': true, 'x-ratelimit-reset': true },
    addHeaders: { 'x-ratelimit-limit': true, 'x-ratelimit-remaining': true, 'x-ratelimit-reset': true, 'retry-after': true },
  })

  // Health check (no auth)
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })

  // Twilio webhook (Twilio signature auth, not API key)
  await fastify.register(webhookRoutes)

  // Protected routes (API key auth)
  await fastify.register(async function protectedRoutes(instance) {
    instance.addHook('onRequest', apiKeyAuth)
    await instance.register(smsRoutes)
    await instance.register(templateRoutes)
    await instance.register(historyRoutes)
  })

  // Graceful shutdown
  const shutdown = async () => {
    fastify.log.info('Shutting down...')
    await fastify.close()
    await prisma.$disconnect()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' })
    fastify.log.info(`DQ-SMS-Server running on port ${config.port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
