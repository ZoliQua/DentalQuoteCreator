import type { SmsTemplate } from '../types.js'

const templates: SmsTemplate[] = [
  {
    id: 'appointment_reminder',
    name: 'Időpont-emlékeztető',
    text: 'Kedves {{patientName}}! Emlékeztetjük, hogy {{appointmentDate}} napon {{appointmentTime}} órára időpontja van rendelőnkben. Kérjük, jelezzen, ha nem tud jönni. Üdvözlettel, {{clinicName}}',
    variables: ['patientName', 'appointmentDate', 'appointmentTime', 'clinicName'],
  },
  {
    id: 'appointment_confirmation',
    name: 'Időpont-megerősítés',
    text: 'Kedves {{patientName}}! Időpontját rögzítettük: {{appointmentDate}}, {{appointmentTime}}. Helyszín: {{clinicName}}. Ha kérdése van, hívjon minket! Üdvözlettel, {{clinicName}}',
    variables: ['patientName', 'appointmentDate', 'appointmentTime', 'clinicName'],
  },
  {
    id: 'quote_ready',
    name: 'Árajánlat kész',
    text: 'Kedves {{patientName}}! Az Ön árajánlata elkészült. Kérjük, tekintse meg rendelőnkben vagy vegye fel velünk a kapcsolatot. Üdvözlettel, {{clinicName}}',
    variables: ['patientName', 'clinicName'],
  },
]

export function getTemplates(): SmsTemplate[] {
  return templates
}

export function getTemplateById(id: string): SmsTemplate | undefined {
  return templates.find((t) => t.id === id)
}

export function renderTemplate(template: SmsTemplate, variables: Record<string, string>): string {
  let text = template.text
  for (const [key, value] of Object.entries(variables)) {
    text = text.replaceAll(`{{${key}}}`, value)
  }

  // Check for unresolved variables
  const unresolved = text.match(/\{\{(\w+)\}\}/g)
  if (unresolved) {
    throw new Error(`Missing template variables: ${unresolved.join(', ')}`)
  }

  return text
}
