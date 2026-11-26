/* ======================================================================
   Wimo Forma · Formas gemensamma aktivitetsbank (grundbank, version 1)

   Inspiration och stöd när projekteringstidplanen upprättas. Varje rad:
   kategori | aktivitet | föreslagen disciplin (kod) | skede | föreslagen längd (arbetsdagar) | förväntat resultat
   Skeden: PS = program, SH = systemhandling, BH = bygghandling, FU = förfrågningsunderlag, PR = produktionsskede, AV = avslut.
   Banken är ett stöd, inte en checklista: den påstår aldrig att en tidplan är komplett.
   Ändringar här ändrar aldrig redan upprättade tidplaner (raderna kopieras in).
   Projektets och företagets egna aktiviteter läggs till med massimport.
   ====================================================================== */
const FO_TP_BANK_RAA = `
Projektstart och organisation|Startmöte projektering|PL|PS|1|Protokoll, organisation och mötesplan
Projektstart och organisation|Upprätta projektorganisation och kontaktlista|PL|PS|3|Kontaktlista i Forma
Projektstart och organisation|Fastställ mötesstruktur och mötesforum|PL|PS|2|Mötesplan
Projektstart och organisation|Upprätta projekteringstidplan|PL|PS|5|Fastställd tidplan
Projektstart och organisation|Upprätta CAD/BIM-manual och lagerstruktur|PL|PS|5|CAD/BIM-manual
Projektstart och organisation|Upprätta handlingsförteckning|PL|PS|3|Handlingsförteckning
Projektstart och organisation|Fastställ ansvarsfördelning mellan discipliner|PL|PS|2|Ansvarsmatris
Projektstart och organisation|Upprätta kvalitets- och miljöplan för projekteringen|PL|PS|5|KMA-plan projektering
Projekteringsförutsättningar|Inhämta beställarens program och krav|PL|PS|5|Rumsfunktionsprogram, tekniska krav
Projekteringsförutsättningar|Inventera befintliga handlingar och underlag|PL|PS|5|Underlagsförteckning
Projekteringsförutsättningar|Beställ grundkarta och nybyggnadskarta|MARK|PS|15|Grundkarta, nybyggnadskarta
Projekteringsförutsättningar|Kontrollera detaljplan och planbestämmelser|A|PS|3|PM detaljplan
Projekteringsförutsättningar|Inventera befintliga ledningar|MARK|PS|10|Ledningsinventering
Projekteringsförutsättningar|Fastställ höjdsystem och koordinatsystem|MARK|PS|2|PM
Projekteringsförutsättningar|Miljöinventering befintlig byggnad|MILJÖ|PS|10|Miljöinventering
Projekteringsförutsättningar|Riv- och miljöinventering inför rivning|MILJÖ|PS|10|Rivningsinventering
Förprojektering|Volymstudier och situationsplan|A|PS|10|Volymstudie, situationsplan
Förprojektering|Val av stomsystem|K|SH|5|PM stomval
Förprojektering|Val av installationssystem|V|SH|5|PM systemval
Förprojektering|Kalkyl i tidigt skede|KALK|SH|5|Kalkyl
Förprojektering|Riskanalys projektering|PL|SH|2|Riskregister
Inköp|Upphandling av projektörer|INK|PS|20|Avtal projektörer
Inköp|Upphandling av geotekniker|INK|PS|10|Avtal geoteknik
Inköp|Förfrågan prefabricerad stomme|INK|BH|15|Anbud stomme
Inköp|Förfrågan hissar|INK|BH|15|Anbud hiss
Inköp|Beställning av långa leveranstider|INK|BH|5|Beställningar
Arkitektur|Planlösningar systemhandling|A|SH|20|Planer SH
Arkitektur|Fasader och sektioner systemhandling|A|SH|15|Fasader, sektioner SH
Arkitektur|Rumsbeskrivning|A|BH|15|Rumsbeskrivning
Arkitektur|Dörr- och fönsterförteckning|A|BH|10|Förteckningar
Arkitektur|Planritningar bygghandling|A|BH|25|Planer BH
Arkitektur|Fasad- och sektionsritningar bygghandling|A|BH|15|Fasader, sektioner BH
Arkitektur|Detaljritningar|A|BH|20|Detaljer
Arkitektur|Inredningsritningar kök och badrum|A|BH|10|Inredningsritningar
Arkitektur|Material- och kulörval|A|BH|5|Material- och kulörbeskrivning
Arkitektur|Teknisk beskrivning bygg (AMA)|A|FU|15|Teknisk beskrivning
Mark och geoteknik|Geoteknisk undersökning|GEO|PS|15|Fältundersökning
Mark och geoteknik|Geoteknisk utredning (PM/MUR)|GEO|SH|10|PM Geoteknik, MUR
Mark och geoteknik|Markplanering och höjdsättning|MARK|SH|10|Markplaneringsplan
Mark och geoteknik|Dagvattenutredning|MARK|SH|10|Dagvatten-PM
Mark och geoteknik|Markritningar bygghandling|MARK|BH|20|Markritningar
Mark och geoteknik|Mark-VA ritningar|MARK|BH|15|VA-ritningar mark
Mark och geoteknik|Förbindelsepunkter VA, el, fjärrvärme|MARK|SH|10|Anvisningar förbindelsepunkter
Grundläggning|Val av grundläggningsmetod|K|SH|5|PM grundläggning
Grundläggning|Grundläggningsritningar|K|BH|15|Grundritningar
Grundläggning|Pålplan|K|BH|10|Pålplan
Grundläggning|Radonskydd och markfukt|K|BH|3|PM radon/markfukt
Konstruktion|Laster och dimensioneringsförutsättningar|K|SH|5|Konstruktionsredovisning
Konstruktion|Stomsystem systemhandling|K|SH|15|Stomritningar SH
Konstruktion|Bjälklagsritningar|K|BH|15|Bjälklagsritningar
Konstruktion|Håltagning i bjälklag och väggar|K|BH|10|Håltagningsritningar
Konstruktion|Stabilitetsberäkning|K|BH|10|Beräkning stabilitet
Konstruktion|Konstruktionsdokumentation (KD)|K|BH|10|Konstruktionsdokumentation
Konstruktion|Armeringsritningar|K|BH|20|Armeringsritningar
Stomme och prefab|Elementplanering prefab|KP|BH|15|Elementplan
Stomme och prefab|Elementritningar prefab|KP|BH|25|Elementritningar
Stomme och prefab|Ingjutningsgods och infästningar|KP|BH|10|Ingjutningsritningar
Stomme och prefab|Monteringsordning stomme|KP|PR|5|Monteringsplan
Stomme och prefab|Granskning av prefabritningar|K|BH|10|Granskningskommentarer
Fasad och klimatskal|Fasadsystem och anslutningsdetaljer|A|BH|10|Fasaddetaljer
Fasad och klimatskal|Takavvattning och taksäkerhet|A|BH|5|Takplan
Fasad och klimatskal|Fönster- och glaspartiförteckning|A|BH|5|Förteckning
Fasad och klimatskal|Lufttäthetsstrategi|A|BH|3|PM lufttäthet
Ventilation|Ventilationssystem systemhandling|V|SH|15|Systemhandling ventilation
Ventilation|Luftflödesberäkning|V|BH|5|Flödesberäkning
Ventilation|Ventilationsritningar bygghandling|V|BH|20|Ventilationsritningar
Ventilation|Aggregat och schakt samordnade|V|BH|5|Samordnade schakt
Ventilation|Teknisk beskrivning ventilation|V|FU|10|Teknisk beskrivning V
VS|VS-system systemhandling|VS|SH|15|Systemhandling VS
VS|Avloppsritningar|VS|BH|15|Avloppsritningar
VS|Tappvatten- och värmeritningar|VS|BH|15|VS-ritningar
VS|Sprinklerutredning|SPR|SH|10|PM sprinkler
VS|Sprinklerritningar|SPR|BH|15|Sprinklerritningar
VS|Teknisk beskrivning VS|VS|FU|10|Teknisk beskrivning VS
El och tele|El- och telesystem systemhandling|E|SH|15|Systemhandling el
El och tele|Belysningsritningar|E|BH|15|Belysningsritningar
El och tele|Kraftritningar|E|BH|15|Kraftritningar
El och tele|Tele, data och passersystem|E|BH|10|Teleritningar
El och tele|Elcentraler och schema|E|BH|10|Centralschema
El och tele|Laddinfrastruktur|E|BH|5|Laddplan
El och tele|Solceller|E|BH|5|Solcellsritningar
El och tele|Teknisk beskrivning el|E|FU|10|Teknisk beskrivning E
Styr och övervakning|Styr- och reglerprinciper|S|SH|5|Funktionsbeskrivning
Styr och övervakning|Styrritningar och apparatförteckning|S|BH|10|Styrritningar
Styr och övervakning|Integration fastighetsautomation|S|BH|5|Integrationsbeskrivning
Brand|Brandskyddsbeskrivning systemhandling|BR|SH|10|Brandskyddsbeskrivning SH
Brand|Brandskyddsbeskrivning bygghandling|BR|BH|10|Brandskyddsbeskrivning BH
Brand|Brandcellsritningar|BR|BH|5|Brandritningar
Brand|Utrymningsstrategi och utrymningsplan|BR|BH|5|Utrymningsplan
Brand|Brandlarm och utrymningslarm|E|BH|10|Larmritningar
Akustik|Akustikkrav och ljudklass|AK|SH|5|PM akustik
Akustik|Trafikbullerutredning|AK|PS|10|Bullerutredning
Akustik|Akustikgranskning bygghandling|AK|BH|5|Granskningsutlåtande
Energi|Energiberäkning|EN|SH|10|Energiberäkning
Energi|Energiberäkning bygghandling (verifierad)|EN|BH|5|Energiberäkning BH
Energi|Klimatdeklaration underlag|EN|BH|10|Klimatberäkning
Fukt|Fuktsäkerhetsprojektering|FUKT|SH|5|Fuktsäkerhetsbeskrivning
Fukt|Fuktsäkerhetsbeskrivning bygghandling|FUKT|BH|5|Fuktsäkerhetsbeskrivning BH
Fukt|Fuktsäker torkplan|FUKT|PR|3|Torkplan
Miljö och hållbarhet|Miljöklassning – kravställning|MILJÖ|PS|5|Kravspecifikation
Miljö och hållbarhet|Materialval och loggbok byggvaror|MILJÖ|BH|5|Materialloggbok
Miljö och hållbarhet|Dagsljusberäkning|A|SH|5|Dagsljusberäkning
Miljö och hållbarhet|Solstudie|A|SH|3|Solstudie
Tillgänglighet|Tillgänglighetsgranskning systemhandling|TILL|SH|5|Granskningsutlåtande
Tillgänglighet|Tillgänglighetsgranskning bygghandling|TILL|BH|5|Granskningsutlåtande
Verksamhetsspecifika krav|Verksamhetsdialoger|PL|SH|10|Mötesanteckningar
Verksamhetsspecifika krav|Utrustningsförteckning verksamhet|A|BH|10|Utrustningsförteckning
Skyddsrum|Skyddsrumsutredning och samråd MSB|K|SH|15|Skyddsrumsbesked
Skyddsrum|Skyddsrumsritningar|K|BH|10|Skyddsrumsritningar
Hissar|Hissutredning och val av hissar|HISS|SH|5|PM hiss
Hissar|Hissritningar och schakt|HISS|BH|5|Hissritningar
Myndighetsprocesser|Förhandsbesked eller planbesked|A|PS|40|Besked
Myndighetsprocesser|Bygglovshandlingar|A|SH|15|Bygglovsansökan
Myndighetsprocesser|Handläggning bygglov|A|SH|50|Beviljat bygglov
Myndighetsprocesser|Rivningslov|A|SH|20|Rivningslov
Myndighetsprocesser|Tekniskt samråd|PL|BH|1|Protokoll tekniskt samråd
Myndighetsprocesser|Kontrollplan PBL|PL|BH|5|Kontrollplan
Myndighetsprocesser|Startbesked|PL|BH|15|Startbesked
Myndighetsprocesser|Anmälan av kontrollansvarig|PL|SH|2|Anmälan
Myndighetsprocesser|Ansökan anslutning el och fjärrvärme|E|BH|20|Anslutningsbesked
Myndighetsprocesser|Trafikanordningsplan och markupplåtelse|MARK|PR|15|TA-plan
Arbetsmiljö och BAS-P|Utse BAS-P|PL|PS|1|Utsedd BAS-P
Arbetsmiljö och BAS-P|Arbetsmiljöplan inför byggskedet|BASP|BH|10|Arbetsmiljöplan
Arbetsmiljö och BAS-P|Riskbedömning projektering (arbetsmiljö)|BASP|SH|3|Riskbedömning
Arbetsmiljö och BAS-P|Förhandsanmälan Arbetsmiljöverket|BASP|PR|2|Förhandsanmälan
Arbetsmiljö och BAS-P|Journal och dokumentation för senare åtgärder|BASP|AV|5|Journal
Teknisk samordning|Samordning schakt och installationsstråk|PL|SH|10|Samordnad schaktplan
Teknisk samordning|3D-samordning och kollisionskontroll|PL|BH|15|Kollisionsrapport
Teknisk samordning|Samordning undertak och installationer|PL|BH|10|Samordnade undertaksplaner
Teknisk samordning|Samordningsmöte installation|PL|BH|1|Protokoll
Kvalitetssäkring|Egenkontroll av handlingar|PL|BH|5|Egenkontroll
Kvalitetssäkring|Tvärgranskning mellan discipliner|PL|BH|10|Granskningskommentarer
Kvalitetssäkring|Granskning av beställaren|BEST|SH|10|Granskningskommentarer
Kvalitetssäkring|Kalkyl efter systemhandling|KALK|SH|5|Kalkyl
Granskning och handlingsleveranser|Leverans systemhandling|PL|SH|0|Systemhandling
Granskning och handlingsleveranser|Granskning systemhandling|BEST|SH|10|Granskningskommentarer
Granskning och handlingsleveranser|Leverans bygglovshandling|PL|SH|0|Bygglovshandling
Granskning och handlingsleveranser|Leverans förfrågningsunderlag|PL|FU|0|Förfrågningsunderlag
Granskning och handlingsleveranser|Leverans bygghandling|PL|BH|0|Bygghandling
Granskning och handlingsleveranser|Granskning bygghandling|BEST|BH|10|Granskningskommentarer
Granskning och handlingsleveranser|Revidering efter granskning|PL|BH|10|Reviderade handlingar
Produktionsförutsättningar|Etableringsplan|PROD|BH|5|Etableringsplan
Produktionsförutsättningar|Produktionsanpassning av handlingar|PROD|BH|10|Kommentarer produktion
Produktionsförutsättningar|Leveransplan material och prefab|PROD|PR|5|Leveransplan
Produktionsförutsättningar|Projektering under produktion (PUB)|PL|PR|40|Löpande handlingar
Provning och driftsättning|Injusteringsprotokoll|V|PR|5|Protokoll
Provning och driftsättning|Samordnad provning (integrerad provning)|S|PR|5|Provningsprotokoll
Provning och driftsättning|Drift- och underhållsinstruktioner|VS|AV|10|DU-instruktioner
Överlämning och avslut|Relationshandlingar|PL|AV|15|Relationshandlingar
Överlämning och avslut|Slutbesked|PL|AV|15|Slutbesked
Överlämning och avslut|Erfarenhetsåterföring projektering|PL|AV|1|Erfarenhetsrapport
Överlämning och avslut|Arkivering av projekthandlingar|PL|AV|5|Arkiv
`;
const FO_TP_SKEDEN = { PS: "Program", SH: "Systemhandling", BH: "Bygghandling", FU: "Förfrågningsunderlag", PR: "Produktion", AV: "Avslut" };
const FO_TP_BANK = FO_TP_BANK_RAA.trim().split("\n").map((r, i) => {
    const [kat, namn, disc, skede, dagar, resultat] = r.split("|");
    return { id: "fb" + i, kalla: "forma", kat, namn, disc, skede, dagar: +dagar || 0, resultat: resultat || "" };
});
