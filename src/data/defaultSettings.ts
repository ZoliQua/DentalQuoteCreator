import { Settings } from '../types';

export const defaultSettings: Settings = {
  clinic: {
    name: 'Mackó Dental Kft.',
    address: '9700 Szombathely, Fő tér 1.',
    phone: '+36 94 123 456',
    email: 'info@mackodental.hu',
    website: 'www.mackodental.hu',
  },
  doctors: [
    { id: 'DOC0001', name: 'Dr. Dul Zoltán', stampNumber: '' },
  ],
  pdf: {
    hu: {
      footerText: 'Az árajánlat tájékoztató jellegű és a fent jelölt ideig érvényes. Nem tartalmazza az esetlegesen kezelés közben fellépő előre nem látható szükséges beavatkozások költségét (pl. gyökérkezelés). Az árak bruttó árak, az ÁFA törvény 85. § (1) bekezdés e) pontja értelmében a fogászati szolgáltatások ÁFA mentesek.',
      warrantyText: `Rendelőnk az alábbi garanciális feltételeket biztosítja a fogászati kezelésekre.

Kérjük, figyelmesen olvassa, és kérdés esetén forduljon hozzánk, majd aláírásval igazolja az itt leírtak tudomásul vételét.

1. TÖMÉSEK
•• Kompozit (esztétikus) tömések: 1 év garancia
• A garancia feltétele a félévenkénti kontrollvizsgálat
• A garancia a tömés törésére, kiesésére vonatkozik

2. PROTETIKAI MUNKÁK
•• Koronák, hidak és kivehető pótlások: 2 év garancia
• A garancia feltétele az évenkénti kontroll és megfelelő szájhigiénia
• A garancia a pótlás törésére, a fém-kerámia leválására vonatkozik.

3. IMPLANTÁTUMOK
•• Implantátum test: 5 év garancia (gyártói garancia)
•• Implantátum felépítmény és korona: 3 év garancia
• Feltétel: félévenkénti kontroll, megfelelő otthoni és professzionális szájhigiénia
• A dohányzás a garancia elvesztését eredményezheti. Kérjük figyeljen az egyéni szájhigiéniára!

4. GYÖKÉRKEZELÉSEK
•• Gyökérkezelés: 1 év garancia
• A garancia a kezelés sikerességére vonatkozik
• Feltétel: a fog időben történő végleges ellátása (tömés vagy korona)

5. A GARANCIA NEM TERJED KI:
• Rendkívüli mechanikai behatásra (baleset, törés kemény tárgy harapásától)
• A páciens mulasztásából eredő károsodásra (nem megfelelő szájhigiénia)
• Az éves kontrollvizsgálatok elmulasztása esetén
• Dohányzás, túlzott alkoholfogyasztás okozta károsodásra.
• A páciens által nem jelzett általános egészségügyi problémákra
• Bruxizmus (fogcsikorgatás) okozta károkra, amennyiben a javasolt fogsín viselése elmarad

6. ÁLTALÁNOS FELTÉTELEK
• Panasz esetén kérjük, 5 munkanapon belül jelentkezzen rendelőnkben
• A garanciális javítás kizárólag rendelőnkben érvényesíthető
• A garancia nem ruházható át, és nem váltható ki készpénzre
• A garanciális javítás nem terjed ki a kapcsolódó költségekre (pl. ideiglenes pótlás)`,
    },
    en: {
      footerText: 'This quote is for informational purposes only and valid until the date indicated above. It does not include the cost of unforeseen necessary interventions during treatment (e.g. root canal treatment). Prices are gross; pursuant to Section 85(1)(e) of the VAT Act, dental services are VAT-exempt.',
      warrantyText: `Our clinic provides the following warranty conditions for dental treatments.

Please read carefully and contact us with any questions, then confirm your acknowledgement with your signature.

1. FILLINGS
•• Composite (aesthetic) fillings: 1-year warranty
• Condition: biannual check-up
• Warranty covers filling fracture or loss

2. PROSTHETIC WORK
•• Crowns, bridges and removable prostheses: 2-year warranty
• Condition: annual check-up and proper oral hygiene
• Warranty covers prosthesis fracture, metal-ceramic delamination

3. IMPLANTS
•• Implant body: 5-year warranty (manufacturer's warranty)
•• Implant abutment and crown: 3-year warranty
• Condition: biannual check-up, proper home and professional oral hygiene
• Smoking may void the warranty. Please maintain personal oral hygiene!

4. ROOT CANAL TREATMENTS
•• Root canal treatment: 1-year warranty
• Warranty covers treatment success
• Condition: timely definitive restoration of the tooth (filling or crown)

5. WARRANTY DOES NOT COVER:
• Extraordinary mechanical impact (accidents, fracture from biting hard objects)
• Damage resulting from patient negligence (inadequate oral hygiene)
• Failure to attend annual check-ups
• Damage caused by smoking or excessive alcohol consumption
• General health problems not reported by the patient
• Damage caused by bruxism (teeth grinding) if the recommended night guard is not worn

6. GENERAL CONDITIONS
• In case of complaint, please contact our clinic within 5 working days
• Warranty repairs are valid only at our clinic
• Warranty is non-transferable and cannot be redeemed for cash
• Warranty repair does not cover associated costs (e.g. temporary prosthesis)`,
    },
    de: {
      footerText: 'Dieses Angebot dient nur zur Information und ist bis zum oben angegebenen Datum gültig. Es beinhaltet nicht die Kosten für unvorhergesehene notwendige Eingriffe während der Behandlung (z.B. Wurzelkanalbehandlung). Die Preise sind Bruttopreise; gemäß § 85 Abs. 1 lit. e) des MwStG sind zahnärztliche Leistungen umsatzsteuerfrei.',
      warrantyText: `Unsere Praxis gewährt die folgenden Garantiebedingungen für zahnärztliche Behandlungen.

Bitte lesen Sie sorgfältig und kontaktieren Sie uns bei Fragen, dann bestätigen Sie Ihre Kenntnisnahme mit Ihrer Unterschrift.

1. FÜLLUNGEN
•• Komposit- (ästhetische) Füllungen: 1 Jahr Garantie
• Bedingung: halbjährliche Kontrolluntersuchung
• Garantie umfasst Füllungsbruch oder -verlust

2. PROTHETISCHE ARBEITEN
•• Kronen, Brücken und herausnehmbare Prothesen: 2 Jahre Garantie
• Bedingung: jährliche Kontrolle und angemessene Mundhygiene
• Garantie umfasst Prothesenfraktur, Metall-Keramik-Ablösung

3. IMPLANTATE
•• Implantatkörper: 5 Jahre Garantie (Herstellergarantie)
•• Implantat-Abutment und Krone: 3 Jahre Garantie
• Bedingung: halbjährliche Kontrolle, angemessene häusliche und professionelle Mundhygiene
• Rauchen kann zum Verlust der Garantie führen. Bitte achten Sie auf Ihre Mundhygiene!

4. WURZELKANALBEHANDLUNGEN
•• Wurzelkanalbehandlung: 1 Jahr Garantie
• Garantie bezieht sich auf den Behandlungserfolg
• Bedingung: rechtzeitige definitive Versorgung des Zahnes (Füllung oder Krone)

5. DIE GARANTIE GILT NICHT FÜR:
• Außergewöhnliche mechanische Einwirkungen (Unfälle, Bruch durch Beißen harter Gegenstände)
• Schäden durch Versäumnis des Patienten (unzureichende Mundhygiene)
• Versäumnis der jährlichen Kontrolluntersuchungen
• Durch Rauchen oder übermäßigen Alkoholkonsum verursachte Schäden
• Vom Patienten nicht gemeldete allgemeine Gesundheitsprobleme
• Durch Bruxismus (Zähneknirschen) verursachte Schäden, wenn die empfohlene Aufbissschiene nicht getragen wird

6. ALLGEMEINE BEDINGUNGEN
• Im Beschwerdefall melden Sie sich bitte innerhalb von 5 Werktagen in unserer Praxis
• Garantiereparaturen gelten nur in unserer Praxis
• Die Garantie ist nicht übertragbar und kann nicht in bar eingelöst werden
• Die Garantiereparatur umfasst nicht die damit verbundenen Kosten (z.B. provisorische Prothese)`,
    },
  },
  quote: {
    prefix: 'MDKD', // Default prefix (can be changed in settings)
    counter: 0,
    deletedCount: 0,
    quoteLang: 'hu',
  },
  invoice: {
    invoiceType: 'paper',
    defaultComment: '',
    defaultVatRate: 'TAM',
    defaultPaymentMethod: 'bankkártya',
  },
  patient: {
    defaultCountry: 'Magyarország',
    patientTypes: ['Privát páciens', 'NEAK páciens'],
  },
  language: 'hu',
  defaultValidityDays: 60,
  dateFormat: 'YYYY-MM-DD HH:MM:SS',
};
