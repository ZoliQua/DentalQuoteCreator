-- Migration: sync catalog translations (catalogNameEn, catalogNameDe) and allowedTeeth from defaultCatalog.ts
-- Generated on 2026-02-15

-- Diagnosztika
UPDATE "CatalogItem" SET "catalogNameEn" = 'Dental examination, Status assessment', "catalogNameDe" = 'Zahnärztliche Untersuchung, Statuserhebung', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'DIAG01';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Consultation and discussion', "catalogNameDe" = 'Beratung und Besprechung', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'DIAG02';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Follow-up examination', "catalogNameDe" = 'Kontrolluntersuchung', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'DIAG03';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Annual check-up examination', "catalogNameDe" = 'Jährliche Kontrolluntersuchung', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'DIAG04';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Focal infection investigation', "catalogNameDe" = 'Herduntersuchung', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'DIAG05';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Intraoral X-ray', "catalogNameDe" = 'Intraorale Röntgenaufnahme', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'DIAG06';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Panoramic X-ray (OPG)', "catalogNameDe" = 'Panorama-Röntgen (OPG)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'DIAG07';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Full CBCT scan', "catalogNameDe" = 'Vollständige CBCT-Aufnahme', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'DIAG08';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Small CBCT scan', "catalogNameDe" = 'Kleine CBCT-Aufnahme', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'DIAG09';

-- Parodontologia
UPDATE "CatalogItem" SET "catalogNameEn" = 'Professional basic tartar removal (per arch)', "catalogNameDe" = 'Professionelle Zahnsteinentfernung (Basis, pro Kiefer)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PARO01';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Professional basic tartar removal (full mouth)', "catalogNameDe" = 'Professionelle Zahnsteinentfernung (Basis, komplett)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PARO02';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Professional oral hygiene instruction, assessment, treatment', "catalogNameDe" = 'Professionelle Mundhygiene-Schulung, Befundung, Behandlung', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PARO03';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Professional oral hygiene follow-up', "catalogNameDe" = 'Professionelle Mundhygiene-Kontrolle', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PARO04';
UPDATE "CatalogItem" SET "catalogNameEn" = 'EMS comprehensive full oral hygiene treatment', "catalogNameDe" = 'EMS umfassende Mundhygiene-Komplettbehandlung', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PARO05';
UPDATE "CatalogItem" SET "catalogNameEn" = 'EMS comprehensive full oral hygiene treatment, assessment, instruction', "catalogNameDe" = 'EMS umfassende Mundhygiene-Komplettbehandlung, Befundung, Schulung', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PARO06';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Deep (closed) curettage (per arch)', "catalogNameDe" = 'Tiefe (geschlossene) Kürettage (pro Kiefer)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PARO07';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Deep (closed) curettage (per quadrant)', "catalogNameDe" = 'Tiefe (geschlossene) Kürettage (pro Quadrant)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PARO08';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Deep (closed) curettage (per tooth)', "catalogNameDe" = 'Tiefe (geschlossene) Kürettage (pro Zahn)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PARO09';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Splinting (per tooth)', "catalogNameDe" = 'Schienung (pro Zahn)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PARO10';

-- Konzervalo
UPDATE "CatalogItem" SET "catalogNameEn" = 'Temporary filling (short-term - Fermin, Citodur)', "catalogNameDe" = 'Provisorische Füllung (kurzfristig - Fermin, Citodur)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'KONZ01';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Long-term temporary filling (glass ionomer)', "catalogNameDe" = 'Langzeitprovisorische Füllung (Glasionomer)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'KONZ02';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Cervical filling on one surface', "catalogNameDe" = 'Zahnhalsfüllung auf einer Fläche', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'KONZ03';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Anterior aesthetic filling (multiple surfaces, incisal edge restoration)', "catalogNameDe" = 'Ästhetische Frontzahnfüllung (mehrere Flächen, Schneidekanten-Aufbau)', "allowedTeeth" = ARRAY[11,12,13,21,22,23,31,32,33,41,42,43]::int[] WHERE "catalogCode" = 'KONZ04';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Posterior tooth filling (1 surface, small)', "catalogNameDe" = 'Seitenzahnfüllung (1 Fläche, klein)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'KONZ05';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Posterior tooth filling (2 surfaces, medium)', "catalogNameDe" = 'Seitenzahnfüllung (2 Flächen, mittel)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'KONZ06';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Posterior tooth filling (3 or more surfaces, large)', "catalogNameDe" = 'Seitenzahnfüllung (3 oder mehr Flächen, groß)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'KONZ07';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Posterior tooth filling (with fiberglass build-up, lined)', "catalogNameDe" = 'Seitenzahnfüllung (mit Glasfaseraufbau, unterfüttert)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'KONZ08';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Direct veneer with aesthetic filling', "catalogNameDe" = 'Direktes Veneer mit ästhetischer Füllung', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'KONZ09';
UPDATE "CatalogItem" SET "catalogNameEn" = 'IPS e.max inlay or onlay', "catalogNameDe" = 'IPS e.max Inlay oder Onlay', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'KONZ10';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Gold inlay or onlay (per unit + gold price)', "catalogNameDe" = 'Gold-Inlay oder -Onlay (pro Stück + Goldpreis)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'KONZ11';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Tooth gem bonding', "catalogNameDe" = 'Zahnschmuck-Befestigung', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'KONZ12';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Tooth gem bonding (patient-supplied gem)', "catalogNameDe" = 'Zahnschmuck-Befestigung (mitgebrachter Schmuck)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'KONZ13';

-- Endodoncia
UPDATE "CatalogItem" SET "catalogNameEn" = 'Trepanation, Mechanical enlargement, Medicated root filling + temporary cover filling', "catalogNameDe" = 'Trepanation, Maschinelle Aufbereitung, Medikamentöse Wurzelfüllung + provisorische Deckfüllung', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'ENDO01';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Medicated root filling replacement + temporary cover filling', "catalogNameDe" = 'Wechsel der medikamentösen Wurzelfüllung + provisorische Deckfüllung', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'ENDO02';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Final root canal filling + temporary cover filling (1-2 canals)', "catalogNameDe" = 'Definitive Wurzelfüllung + provisorische Deckfüllung (1-2 Kanäle)', "allowedTeeth" = ARRAY[11,12,13,14,15,21,22,23,24,25,31,32,33,34,35,41,42,43,44,45]::int[] WHERE "catalogCode" = 'ENDO03';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Final root canal filling + temporary cover filling (3-4 canals)', "catalogNameDe" = 'Definitive Wurzelfüllung + provisorische Deckfüllung (3-4 Kanäle)', "allowedTeeth" = ARRAY[16,17,18,26,27,28,36,37,38,46,47,48]::int[] WHERE "catalogCode" = 'ENDO04';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Removal of old root canal filling', "catalogNameDe" = 'Entfernung alter Wurzelfüllung', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'ENDO05';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Core build-up with filling material', "catalogNameDe" = 'Stumpfaufbau mit Füllungsmaterial', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'ENDO06';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Root post placement (direct, fiberglass-reinforced)', "catalogNameDe" = 'Wurzelstift-Einsetzen (direkt, glasfaserverstärkt)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'ENDO07';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Root post placement cast (indirect, lab-made metal post)', "catalogNameDe" = 'Wurzelstift-Einsetzen gegossen (indirekt, laborgefertigter Metallstift)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'ENDO08';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Bleaching of root canal treated tooth (per session)', "catalogNameDe" = 'Bleaching eines wurzelbehandelten Zahns (pro Sitzung)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'ENDO09';

-- Szajsebeszet
UPDATE "CatalogItem" SET "catalogNameEn" = 'Simple tooth extraction (single-rooted or mobile tooth)', "catalogNameDe" = 'Einfache Zahnextraktion (einwurzelig oder lockerer Zahn)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'SEB01';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Tooth extraction (two-rooted, standard case)', "catalogNameDe" = 'Zahnextraktion (zweiwurzelig, Standardfall)', "allowedTeeth" = ARRAY[14,15,24,25,34,35,44,45]::int[] WHERE "catalogCode" = 'SEB02';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Tooth extraction (three-rooted, standard case)', "catalogNameDe" = 'Zahnextraktion (dreiwurzelig, Standardfall)', "allowedTeeth" = ARRAY[16,17,18,26,27,28,36,37,38,46,47,48]::int[] WHERE "catalogCode" = 'SEB03';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Surgical tooth extraction with flap, complicated extraction', "catalogNameDe" = 'Zahnextraktion mit Aufklappung, erschwerte Extraktion', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'SEB04';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Wisdom tooth extraction', "catalogNameDe" = 'Weisheitszahnentfernung', "allowedTeeth" = ARRAY[18,28,38,48]::int[] WHERE "catalogCode" = 'SEB05';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Apicoectomy', "catalogNameDe" = 'Wurzelspitzenresektion', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'SEB06';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Sinus (maxillary sinus) closure (if necessary)', "catalogNameDe" = 'Sinusverschluss (Kieferhöhle) (bei Bedarf)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'SEB07';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Suture placement', "catalogNameDe" = 'Nahtlegung', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'SEB08';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Suture removal', "catalogNameDe" = 'Nahtentfernung', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'SEB09';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Medication administration (pain relief)', "catalogNameDe" = 'Medikamentenverabreichung (Schmerzmittel)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'SEB10';

-- Implantacio
UPDATE "CatalogItem" SET "catalogNameEn" = 'Implant surgery fee (single-use sterile instruments)', "catalogNameDe" = 'Implantations-OP-Gebühr (sterile Einweginstrumente)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'IMP01';
UPDATE "CatalogItem" SET "catalogNameEn" = 'AlphaBio Neo implant placement', "catalogNameDe" = 'AlphaBio Neo Implantat-Einsetzen', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'IMP02';
UPDATE "CatalogItem" SET "catalogNameEn" = 'AlphaBio abutment (straight through) screw placement', "catalogNameDe" = 'AlphaBio Aufbau (gerades Durchgangs-) Schraubeneinsetzen', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'IMP03';
UPDATE "CatalogItem" SET "catalogNameEn" = 'AlphaBio abutment (angled through) screw placement', "catalogNameDe" = 'AlphaBio Aufbau (abgewinkeltes Durchgangs-) Schraubeneinsetzen', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'IMP04';
UPDATE "CatalogItem" SET "catalogNameEn" = 'AlphaBio abutment (multi-unit) base screw placement', "catalogNameDe" = 'AlphaBio Aufbau (Multi-Unit) Basisschraubeneinsetzen', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'IMP05';
UPDATE "CatalogItem" SET "catalogNameEn" = 'AlphaBio abutment (multi-unit) straight head placement', "catalogNameDe" = 'AlphaBio Aufbau (Multi-Unit) gerades Kopfeinsetzen', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'IMP06';
UPDATE "CatalogItem" SET "catalogNameEn" = 'AlphaBio abutment (multi-unit) angled head placement', "catalogNameDe" = 'AlphaBio Aufbau (Multi-Unit) abgewinkeltes Kopfeinsetzen', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'IMP07';
UPDATE "CatalogItem" SET "catalogNameEn" = 'AlphaBio locator head', "catalogNameDe" = 'AlphaBio Locator-Kopf', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'IMP08';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Individually milled bar base', "catalogNameDe" = 'Individuell gefräste Stegbasis', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'IMP09';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Implant-supported bar denture (12 teeth)', "catalogNameDe" = 'Implantatgetragene Stegprothese (12 Zähne)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'IMP10';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Implant-supported bar denture (14 teeth)', "catalogNameDe" = 'Implantatgetragene Stegprothese (14 Zähne)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'IMP11';
UPDATE "CatalogItem" SET "catalogNameEn" = 'AlphaBio abutment gingival mask', "catalogNameDe" = 'AlphaBio Aufbau-Gingivamaske', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'IMP12';
UPDATE "CatalogItem" SET "catalogNameEn" = '3D model fabrication, bite registration (for implants)', "catalogNameDe" = '3D-Modellherstellung, Bissregistrierung (für Implantate)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'IMP13';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Surgical implant guide (for 1 tooth)', "catalogNameDe" = 'Chirurgische Implantat-Bohrschablone (für 1 Zahn)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'IMP14';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Surgical implant guide (for 2 teeth)', "catalogNameDe" = 'Chirurgische Implantat-Bohrschablone (für 2 Zähne)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'IMP15';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Surgical implant guide (for 3 teeth)', "catalogNameDe" = 'Chirurgische Implantat-Bohrschablone (für 3 Zähne)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'IMP16';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Surgical implant guide (for 4 teeth)', "catalogNameDe" = 'Chirurgische Implantat-Bohrschablone (für 4 Zähne)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'IMP17';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Implant uncovering + healing abutment placement', "catalogNameDe" = 'Implantatfreilegung + Einheilkappe-Einsetzen', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'IMP18';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Foreign implant - technical procurement costs', "catalogNameDe" = 'Fremdimplantat - technische Beschaffungskosten', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'IMP19';

-- Protetika
UPDATE "CatalogItem" SET "catalogNameEn" = 'Digital 3D impression with scanner', "catalogNameDe" = 'Digitaler 3D-Abdruck mit Scanner', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT01';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Temporary crown or bridge unit (chairside)', "catalogNameDe" = 'Provisorische Krone oder Brückenglied (praxisgefertigt)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT02';
UPDATE "CatalogItem" SET "catalogNameEn" = 'PMMA temporary crown or bridge unit (lab-made) - short-term', "catalogNameDe" = 'PMMA provisorische Krone oder Brückenglied (laborgefertigt) - kurzfristig', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT03';
UPDATE "CatalogItem" SET "catalogNameEn" = 'PMMA temporary crown or bridge unit (lab-made) - long-term', "catalogNameDe" = 'PMMA provisorische Krone oder Brückenglied (laborgefertigt) - langfristig', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT04';
UPDATE "CatalogItem" SET "catalogNameEn" = 'PMMA follow-up examination, discussion', "catalogNameDe" = 'PMMA Kontrolluntersuchung, Besprechung', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT05';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Metal-ceramic crown or bridge unit (cobalt-chromium)', "catalogNameDe" = 'Metallkeramikkrone oder Brückenglied (Kobalt-Chrom)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT06';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Metal-ceramic crown or bridge unit (titanium)', "catalogNameDe" = 'Metallkeramikkrone oder Brückenglied (Titan)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT07';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Metal-ceramic crown on implant (cobalt-chromium)', "catalogNameDe" = 'Metallkeramikkrone auf Implantat (Kobalt-Chrom)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT08';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Zirconium dioxide crown or bridge unit (metal-free)', "catalogNameDe" = 'Zirkoniumdioxid-Krone oder Brückenglied (metallfrei)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT09';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Zirconium dioxide crown or bridge unit on implant', "catalogNameDe" = 'Zirkoniumdioxid-Krone oder Brückenglied auf Implantat', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT10';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Pressed ceramic crown (IPS e.max)', "catalogNameDe" = 'Presskeramikkrone (IPS e.max)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT11';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Primary telescopic crown', "catalogNameDe" = 'Primäre Teleskopkrone', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT12';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Secondary telescopic crown', "catalogNameDe" = 'Sekundäre Teleskopkrone', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT13';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Telescopic crown ceramic veneering', "catalogNameDe" = 'Teleskopkrone Keramikverblendung', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT14';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Crown sectioning, bridge removal', "catalogNameDe" = 'Kronenaufschneiden, Brückenabnahme', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT15';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Crown re-cementation (external single crown)', "catalogNameDe" = 'Kronenwiederbefestigung (externe Einzelkrone)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT16';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Bridge re-cementation (external prosthesis 2-3 units)', "catalogNameDe" = 'Brückenwiederbefestigung (externe Versorgung 2-3 Glieder)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT17';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Bridge re-cementation (external prosthesis 4-6 units)', "catalogNameDe" = 'Brückenwiederbefestigung (externe Versorgung 4-6 Glieder)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT18';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Bridge re-cementation (external prosthesis over 7 units)', "catalogNameDe" = 'Brückenwiederbefestigung (externe Versorgung über 7 Glieder)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT19';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Conventional removable complete denture (acrylic)', "catalogNameDe" = 'Herkömmliche herausnehmbare Totalprothese (Acryl)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT20';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Premium removable complete denture (Candulor)', "catalogNameDe" = 'Premium herausnehmbare Totalprothese (Candulor)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT21';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Flexible removable complete denture (Vertex, Bredent)', "catalogNameDe" = 'Flexible herausnehmbare Totalprothese (Vertex, Bredent)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT22';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Temporary conventional removable complete denture (acrylic)', "catalogNameDe" = 'Provisorische herkömmliche herausnehmbare Totalprothese (Acryl)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT23';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Temporary 1 or 2 tooth removable clip prosthesis', "catalogNameDe" = 'Provisorische herausnehmbare Klipp-Prothese (1 oder 2 Zähne)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT24';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Temporary 1 or 2 tooth removable splint prosthesis', "catalogNameDe" = 'Provisorische herausnehmbare Schienen-Prothese (1 oder 2 Zähne)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT25';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Denture base plate from cast acrylic', "catalogNameDe" = 'Prothesenbasisplatte aus Gießacryl', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT26';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Precision attachment (interlock, ball heads)', "catalogNameDe" = 'Präzisionsgeschiebe (Interlock, Kugelköpfe)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT27';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Clasp retention (per unit)', "catalogNameDe" = 'Klammerverankerung (pro Stück)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT28';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Metal plate (for removable prostheses)', "catalogNameDe" = 'Metallplatte (für herausnehmbare Prothesen)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT29';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Cast metal mesh (for removable prosthesis)', "catalogNameDe" = 'Gegossenes Metallnetz (für herausnehmbare Prothese)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT30';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Acrylic teeth for removable denture (standard)', "catalogNameDe" = 'Kunststoffzähne für herausnehmbare Prothese (Standard)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT31';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Acrylic teeth for removable denture (premium - Vita Physiodens)', "catalogNameDe" = 'Kunststoffzähne für herausnehmbare Prothese (Premium - Vita Physiodens)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT32';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Bite registration template fabrication (lab-made)', "catalogNameDe" = 'Bissschablone-Herstellung (laborgefertigt)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT33';
UPDATE "CatalogItem" SET "catalogNameEn" = '3D printed custom tray fabrication (lab-made)', "catalogNameDe" = '3D-gedruckte individuelle Löffelherstellung (laborgefertigt)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT34';
UPDATE "CatalogItem" SET "catalogNameEn" = '3D printed model fabrication (per arch)', "catalogNameDe" = '3D-gedruckte Modellherstellung (pro Kiefer)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT35';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Denture relining (lab-made)', "catalogNameDe" = 'Prothesenunterfütterung (laborgefertigt)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT36';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Denture cleaning (chairside)', "catalogNameDe" = 'Prothesenreinigung (praxisgefertigt)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT37';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Bite raising splint', "catalogNameDe" = 'Aufbissschiene', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT38';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Bruxism (teeth grinding) splint', "catalogNameDe" = 'Bruxismus-Schiene (Knirscherschiene)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'PROT39';

-- Gyerekfogaszat
UPDATE "CatalogItem" SET "catalogNameEn" = 'Familiarization, getting to know the dental office', "catalogNameDe" = 'Eingewöhnung, Kennenlernen der Praxis', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'GYER01';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Deciduous tooth filling with temporary filling (Citodur, Fermin)', "catalogNameDe" = 'Milchzahnfüllung mit provisorischer Füllung (Citodur, Fermin)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'GYER02';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Deciduous tooth filling long-term (glass ionomer)', "catalogNameDe" = 'Milchzahnfüllung langfristig (Glasionomer)', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'GYER03';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Plaque staining and oral hygiene instruction', "catalogNameDe" = 'Plaqueanfärbung und Mundhygiene-Unterweisung', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'GYER04';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Fissure sealing on permanent tooth', "catalogNameDe" = 'Fissurenversiegelung am bleibenden Zahn', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'GYER05';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Deciduous tooth trepanation, extirpation', "catalogNameDe" = 'Milchzahn-Trepanation, Extirpation', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'GYER06';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Deciduous tooth extraction', "catalogNameDe" = 'Milchzahnextraktion', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'GYER07';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Deciduous dentition cleaning, polishing', "catalogNameDe" = 'Milchgebiss-Reinigung, Politur', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'GYER08';

-- Fogszabalyozas
UPDATE "CatalogItem" SET "catalogNameEn" = '3D treatment plan for orthodontics', "catalogNameDe" = '3D-Behandlungsplan für Kieferorthopädie', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'SZAB01';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Attachment bonding for BioAligner system', "catalogNameDe" = 'Attachment-Befestigung für BioAligner-System', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'SZAB02';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Orthodontic cleaning kit', "catalogNameDe" = 'Kieferorthopädisches Reinigungsset', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'SZAB03';
UPDATE "CatalogItem" SET "catalogNameEn" = 'BioAligner invisible orthodontic aligner', "catalogNameDe" = 'BioAligner unsichtbare kieferorthopädische Schiene', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'SZAB04';
UPDATE "CatalogItem" SET "catalogNameEn" = 'Orthodontic retention splint', "catalogNameDe" = 'Kieferorthopädische Retentionsschiene', "allowedTeeth" = '{}'::int[] WHERE "catalogCode" = 'SZAB05';
