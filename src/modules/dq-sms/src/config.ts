import 'dotenv/config'

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export const config = {
  port: parseInt(process.env.PORT || '4100', 10),
  databaseUrl: requireEnv('DATABASE_URL'),
  twilioAccountSid: requireEnv('TWILIO_ACCOUNT_SID'),
  twilioAuthToken: requireEnv('TWILIO_AUTH_TOKEN'),
  twilioPhoneNumber: requireEnv('TWILIO_PHONE_NUMBER'),
  smsApiKey: requireEnv('SMS_API_KEY'),
  twilioWebhookUrl: process.env.TWILIO_WEBHOOK_URL || '',
}
