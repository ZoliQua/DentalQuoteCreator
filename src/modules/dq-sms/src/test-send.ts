import 'dotenv/config'

const BASE_URL = process.env.SMS_SERVER_URL || 'http://localhost:4100'
const API_KEY = process.env.SMS_API_KEY || 'test-api-key'

async function testHealthCheck() {
  console.log('\n--- Health Check ---')
  const res = await fetch(`${BASE_URL}/health`)
  console.log('Status:', res.status)
  console.log('Body:', await res.json())
}

async function testGetTemplates() {
  console.log('\n--- Get Templates ---')
  const res = await fetch(`${BASE_URL}/sms/templates`, {
    headers: { 'x-api-key': API_KEY },
  })
  console.log('Status:', res.status)
  console.log('Body:', JSON.stringify(await res.json(), null, 2))
}

async function testSendSms() {
  console.log('\n--- Send SMS ---')
  const res = await fetch(`${BASE_URL}/sms/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({
      to: '+36201234567',
      message: 'Teszt SMS a DQ-SMS-Server-ből!',
      patientName: 'Teszt Páciens',
      context: 'manual_test',
    }),
  })
  console.log('Status:', res.status)
  console.log('Body:', JSON.stringify(await res.json(), null, 2))
}

async function testSendTemplateSms() {
  console.log('\n--- Send Template SMS ---')
  const res = await fetch(`${BASE_URL}/sms/send-template`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({
      to: '+36201234567',
      templateId: 'appointment_reminder',
      variables: {
        patientName: 'Kovács János',
        appointmentDate: '2026-03-10',
        appointmentTime: '14:00',
        clinicName: 'DentalQuote Rendelő',
      },
      patientName: 'Kovács János',
      context: 'manual_test',
    }),
  })
  console.log('Status:', res.status)
  console.log('Body:', JSON.stringify(await res.json(), null, 2))
}

async function testGetHistory() {
  console.log('\n--- Get SMS History ---')
  const res = await fetch(`${BASE_URL}/sms/history?limit=5`, {
    headers: { 'x-api-key': API_KEY },
  })
  console.log('Status:', res.status)
  console.log('Body:', JSON.stringify(await res.json(), null, 2))
}

async function testUnauthorized() {
  console.log('\n--- Unauthorized Request (no API key) ---')
  const res = await fetch(`${BASE_URL}/sms/templates`)
  console.log('Status:', res.status)
  console.log('Body:', await res.json())
}

async function main() {
  console.log('=== DQ-SMS-Server Smoke Test ===')
  console.log(`Server: ${BASE_URL}`)

  try {
    await testHealthCheck()
    await testUnauthorized()
    await testGetTemplates()
    await testGetHistory()

    // Uncomment to test actual SMS sending (requires valid Twilio credentials):
    // await testSendSms()
    // await testSendTemplateSms()

    console.log('\n=== All tests completed ===')
  } catch (err) {
    console.error('\nTest failed:', err)
    process.exit(1)
  }
}

main()
