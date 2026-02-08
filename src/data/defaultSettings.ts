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
    { id: 'doc-1', name: 'Dr. Dul Zoltán', stampNumber: '' },
  ],
  pdf: {
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
  quote: {
    prefix: 'MDKD', // Default prefix (can be changed in settings)
    counter: 0,
    deletedCount: 0,
  },
  language: 'hu',
  defaultValidityDays: 60,
  dateFormat: 'YYYY-MM-DD HH:MM:SS',
};
