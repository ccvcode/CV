"""Nomenclator CAEN: cod de activitate → descriere + secțiune economică.

Permite filtrarea firmelor pe domenii (ex. toate construcțiile, tot IT-ul).

- `caen_section(cod)` întoarce secțiunea (litera A–U) și denumirea ei pentru
  ORICE cod valid, calculată din diviziune (primele 2 cifre). Funcționează
  chiar dacă nu avem descrierea exactă a codului.
- `caen_description(cod)` întoarce descrierea codului, dacă e cunoscută.

Notă: România a trecut treptat la CAEN Rev.3 (2025). Codurile pe 4 cifre și
secțiunile A–U rămân compatibile în mare; descrierile marcate aici sunt cele
uzuale Rev.2 și sunt orientative pentru codurile mai noi.
"""

from __future__ import annotations

from typing import Optional

# (diviziune_start, diviziune_sfarsit, literă_secțiune, denumire_secțiune)
_SECTIONS = [
    (1, 3, "A", "Agricultură, silvicultură și pescuit"),
    (5, 9, "B", "Industria extractivă"),
    (10, 33, "C", "Industria prelucrătoare"),
    (35, 35, "D", "Producția și furnizarea de energie electrică, termică și gaze"),
    (36, 39, "E", "Distribuția apei; salubritate, gestionarea deșeurilor"),
    (41, 43, "F", "Construcții"),
    (45, 47, "G", "Comerț cu ridicata și amănuntul; repararea autovehiculelor"),
    (49, 53, "H", "Transport și depozitare"),
    (55, 56, "I", "Hoteluri și restaurante"),
    (58, 63, "J", "Informații și comunicații"),
    (64, 66, "K", "Intermedieri financiare și asigurări"),
    (68, 68, "L", "Tranzacții imobiliare"),
    (69, 75, "M", "Activități profesionale, științifice și tehnice"),
    (77, 82, "N", "Activități de servicii administrative și de suport"),
    (84, 84, "O", "Administrație publică și apărare"),
    (85, 85, "P", "Învățământ"),
    (86, 88, "Q", "Sănătate și asistență socială"),
    (90, 93, "R", "Activități de spectacole, culturale și recreative"),
    (94, 96, "S", "Alte activități de servicii"),
    (97, 98, "T", "Activități ale gospodăriilor private"),
    (99, 99, "U", "Activități ale organizațiilor extrateritoriale"),
]

# Descrieri pentru codurile uzuale (denumiri Rev.2, prescurtate).
CAEN_DESCRIERI: dict[str, str] = {
    "0111": "Cultivarea cerealelor și plantelor oleaginoase",
    "0113": "Cultivarea legumelor",
    "0150": "Activități mixte (cultura vegetală și creșterea animalelor)",
    "0161": "Activități auxiliare pentru producția vegetală",
    "0910": "Activități de servicii anexe extracției petrolului și gazelor",
    "1013": "Prepararea produselor din carne",
    "1071": "Fabricarea pâinii; produse de patiserie proaspete",
    "1085": "Fabricarea de mâncăruri preparate",
    "1101": "Distilarea băuturilor alcoolice",
    "1610": "Tăierea și rindeluirea lemnului",
    "1623": "Fabricarea altor elemente de dulgherie și tâmplărie",
    "1812": "Alte activități de tipărire",
    "2016": "Fabricarea materialelor plastice în forme primare",
    "2222": "Fabricarea articolelor de ambalaj din material plastic",
    "2452": "Turnarea oțelului",
    "2562": "Operațiuni de mecanică generală",
    "2652": "Fabricarea ceasurilor",
    "3101": "Fabricarea de mobilă pentru birouri și magazine",
    "3109": "Fabricarea de mobilă",
    "3299": "Fabricarea altor produse manufacturiere",
    "3512": "Transportul energiei electrice",
    "3600": "Captarea, tratarea și distribuția apei",
    "3811": "Colectarea deșeurilor nepericuloase",
    "4110": "Dezvoltare (promovare) imobiliară",
    "4120": "Lucrări de construcții a clădirilor rezidențiale și nerezidențiale",
    "4100": "Construcții de clădiri",
    "4211": "Lucrări de construcții a drumurilor și autostrăzilor",
    "4221": "Lucrări de construcții a proiectelor utilitare pentru fluide",
    "4299": "Lucrări de construcții a altor proiecte inginerești",
    "4311": "Lucrări de demolare a construcțiilor",
    "4312": "Lucrări de pregătire a terenului",
    "4321": "Lucrări de instalații electrice",
    "4322": "Lucrări de instalații sanitare, de încălzire și climatizare",
    "4329": "Alte lucrări de instalații pentru construcții",
    "4331": "Lucrări de ipsoserie",
    "4332": "Lucrări de tâmplărie și dulgherie",
    "4333": "Lucrări de pardosire și placare a pereților",
    "4334": "Lucrări de vopsitorie, zugrăveli și montări de geamuri",
    "4339": "Alte lucrări de finisare",
    "4341": "Lucrări de învelitori, șarpante și terase la construcții",
    "4391": "Lucrări de învelitori, șarpante și terase",
    "4399": "Alte lucrări speciale de construcții",
    "4511": "Comerț cu autoturisme și autovehicule ușoare",
    "4520": "Întreținerea și repararea autovehiculelor",
    "4531": "Comerț cu ridicata de piese și accesorii auto",
    "4532": "Comerț cu amănuntul de piese și accesorii auto",
    "4619": "Intermedieri în comerțul cu produse diverse",
    "4621": "Comerț cu ridicata al cerealelor și furajelor",
    "4631": "Comerț cu ridicata al fructelor și legumelor",
    "4639": "Comerț cu ridicata nespecializat de alimente, băuturi, tutun",
    "4641": "Comerț cu ridicata al produselor textile",
    "4649": "Comerț cu ridicata al altor bunuri de uz gospodăresc",
    "4651": "Comerț cu ridicata al calculatoarelor și software-ului",
    "4671": "Comerț cu ridicata al combustibililor solizi, lichizi și gazoși",
    "4673": "Comerț cu ridicata al materialului lemnos și de construcții",
    "4687": "Comerț cu ridicata (alte produse)",
    "4690": "Comerț cu ridicata nespecializat",
    "4711": "Comerț cu amănuntul, predominant alimentar (magazin)",
    "4712": "Comerț cu amănuntul în magazine nespecializate",
    "4719": "Comerț cu amănuntul în magazine nespecializate (nealimentar)",
    "4721": "Comerț cu amănuntul al fructelor și legumelor",
    "4729": "Comerț cu amănuntul al altor produse alimentare",
    "4741": "Comerț cu amănuntul al calculatoarelor și software-ului",
    "4751": "Comerț cu amănuntul al textilelor",
    "4752": "Comerț cu amănuntul al articolelor de fierărie, vopsele, sticlă",
    "4759": "Comerț cu amănuntul de mobilă și articole de uz casnic",
    "4771": "Comerț cu amănuntul al îmbrăcămintei",
    "4772": "Comerț cu amănuntul al încălțămintei și articolelor din piele",
    "4774": "Comerț cu amănuntul al articolelor medicale și ortopedice",
    "4775": "Comerț cu amănuntul al produselor cosmetice și de parfumerie",
    "4778": "Comerț cu amănuntul al altor bunuri noi, în magazine specializate",
    "4779": "Comerț cu amănuntul al bunurilor de ocazie",
    "4781": "Comerț cu amănuntul al produselor alimentare, în standuri/piețe",
    "4782": "Comerț cu amănuntul al textilelor, în standuri și piețe",
    "4789": "Comerț cu amănuntul prin standuri, chioșcuri și piețe",
    "4791": "Comerț cu amănuntul prin internet / comandă poștală",
    "4799": "Comerț cu amănuntul care nu se efectuează prin magazine",
    "4931": "Transporturi urbane și suburbane de călători",
    "4932": "Transporturi cu taxiuri",
    "4933": "Alte transporturi terestre de călători",
    "4941": "Transporturi rutiere de mărfuri",
    "4942": "Servicii de mutare",
    "5210": "Depozitări",
    "5221": "Activități de servicii anexe transporturilor terestre",
    "5310": "Activități poștale (serviciu universal)",
    "5320": "Alte activități de curierat",
    "5510": "Hoteluri și alte facilități de cazare similare",
    "5520": "Facilități de cazare pentru vacanțe și perioade de scurtă durată",
    "5590": "Alte servicii de cazare",
    "5610": "Restaurante",
    "5611": "Restaurante",
    "5612": "Activități de alimentație (fast-food, ambulant)",
    "5621": "Activități de alimentație (catering) pentru evenimente",
    "5629": "Alte activități de alimentație",
    "5630": "Baruri și alte activități de servire a băuturilor",
    "5811": "Activități de editare a cărților",
    "5814": "Activități de editare a revistelor și periodicelor",
    "5821": "Activități de editare a jocurilor de calculator",
    "5829": "Activități de editare a altor produse software",
    "5911": "Producție de filme, video și programe TV",
    "6010": "Activități de difuzare a programelor de radio",
    "6110": "Activități de telecomunicații prin rețele cu cablu",
    "6120": "Activități de telecomunicații prin rețele fără cablu",
    "6201": "Activități de realizare a soft-ului la comandă",
    "6202": "Activități de consultanță în tehnologia informației",
    "6203": "Activități de management (gestiune și exploatare) a mijloacelor de calcul",
    "6209": "Alte activități de servicii privind tehnologia informației",
    "6210": "Activități de realizare a software-ului / IT",
    "6220": "Servicii digitale / IT",
    "6311": "Prelucrarea datelor, administrarea paginilor web",
    "6312": "Activități ale portalurilor web",
    "6310": "Prelucrarea datelor, găzduire web și portaluri",
    "6391": "Activități ale agențiilor de știri",
    "6399": "Alte activități de servicii informaționale",
    "6419": "Alte activități de intermedieri monetare",
    "6492": "Alte activități de creditare",
    "6499": "Alte intermedieri financiare",
    "6612": "Activități de intermediere a tranzacțiilor financiare",
    "6619": "Activități auxiliare intermedierilor financiare",
    "6622": "Activități ale agenților și broker-ilor de asigurări",
    "6810": "Cumpărarea și vânzarea de bunuri imobiliare proprii",
    "6812": "Tranzacții imobiliare",
    "6820": "Închirierea și subînchirierea bunurilor imobiliare proprii",
    "6831": "Agenții imobiliare",
    "6832": "Administrarea imobilelor pe bază de comision sau contract",
    "6910": "Activități juridice",
    "6920": "Activități de contabilitate, audit și consultanță fiscală",
    "7010": "Activități ale direcțiilor (holding-urilor)",
    "7011": "Activități ale direcțiilor și birourilor centrale",
    "7020": "Activități de consultanță în management",
    "7021": "Activități de consultanță în relații publice și comunicare",
    "7022": "Activități de consultanță pentru afaceri și management",
    "7111": "Activități de arhitectură",
    "7112": "Activități de inginerie și consultanță tehnică",
    "7120": "Activități de testări și analize tehnice",
    "7211": "Cercetare-dezvoltare în biotehnologie",
    "7311": "Activități ale agențiilor de publicitate",
    "7312": "Servicii de reprezentare media",
    "7320": "Activități de studiere a pieței și de sondare a opiniei publice",
    "7410": "Activități de design specializat",
    "7411": "Activități de design specializat",
    "7413": "Activități de design specializat",
    "7420": "Activități fotografice",
    "7430": "Activități de traducere scrisă și orală",
    "7490": "Alte activități profesionale, științifice și tehnice",
    "7500": "Activități veterinare",
    "7711": "Închirierea de autoturisme și autovehicule ușoare",
    "7810": "Activități ale agențiilor de plasare a forței de muncă",
    "7820": "Activități de contractare, pe baze temporare, a personalului",
    "7911": "Activități ale agențiilor turistice",
    "7912": "Activități ale tur-operatorilor",
    "8110": "Activități de servicii suport combinate",
    "8121": "Activități generale de curățenie a clădirilor",
    "8122": "Alte activități de curățenie a clădirilor și mijloacelor de transport",
    "8129": "Alte activități de curățenie",
    "8130": "Activități de întreținere peisagistică",
    "8211": "Activități combinate de secretariat",
    "8219": "Activități de fotocopiere, pregătire documente, suport birou",
    "8230": "Activități de organizare a expozițiilor, târgurilor și congreselor",
    "8240": "Activități de servicii suport pentru întreprinderi",
    "8299": "Alte activități de servicii suport pentru întreprinderi",
    "8510": "Învățământ preșcolar",
    "8520": "Învățământ primar",
    "8551": "Învățământ în domeniul sportiv și recreațional",
    "8552": "Învățământ în domeniul cultural (limbi străine, muzică etc.)",
    "8559": "Alte forme de învățământ",
    "8560": "Activități de servicii suport pentru învățământ",
    "8569": "Activități de servicii suport pentru învățământ",
    "8610": "Activități de asistență spitalicească",
    "8621": "Activități de asistență medicală generală",
    "8622": "Activități de asistență medicală specializată",
    "8623": "Activități de asistență stomatologică",
    "8690": "Alte activități referitoare la sănătatea umană",
    "8710": "Activități ale centrelor de îngrijire medicală",
    "8810": "Activități de asistență socială fără cazare pentru bătrâni",
    "8891": "Activități de îngrijire zilnică pentru copii",
    "9001": "Activități de interpretare artistică (spectacole)",
    "9003": "Activități de creație artistică",
    "9004": "Activități de gestionare a sălilor de spectacole",
    "9101": "Activități ale bibliotecilor și arhivelor",
    "9200": "Activități de jocuri de noroc și pariuri",
    "9311": "Activități ale bazelor sportive",
    "9312": "Activități ale cluburilor sportive",
    "9313": "Activități ale centrelor de fitness",
    "9319": "Alte activități sportive",
    "9329": "Alte activități recreative și distractive",
    "9411": "Activități ale organizațiilor economice și patronale",
    "9511": "Repararea calculatoarelor și echipamentelor periferice",
    "9512": "Repararea echipamentelor de comunicații",
    "9521": "Repararea aparatelor electronice de uz casnic",
    "9523": "Repararea încălțămintei și articolelor din piele",
    "9524": "Repararea mobilei și a furniturilor casnice",
    "9525": "Repararea ceasurilor și a bijuteriilor",
    "9529": "Repararea altor articole de uz personal și gospodăresc",
    "9601": "Spălarea și curățarea (uscată) articolelor textile și blănurilor",
    "9602": "Coafură și alte activități de înfrumusețare",
    "9603": "Activități de pompe funebre și similare",
    "9604": "Activități de întreținere corporală",
    "9609": "Alte activități de servicii",
    "9621": "Coafură și înfrumusețare",
}


def _first_two_digits(cod: Optional[str]) -> Optional[int]:
    if not cod:
        return None
    digits = "".join(ch for ch in str(cod) if ch.isdigit())
    if len(digits) < 2:
        return None
    # Codurile CAEN au 4 cifre; diviziunea = primele 2 cifre.
    try:
        return int(digits[:2])
    except ValueError:
        return None


def caen_section(cod: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """Întoarce (literă_secțiune, denumire_secțiune) pentru un cod CAEN."""
    div = _first_two_digits(cod)
    if div is None:
        return (None, None)
    for start, end, letter, name in _SECTIONS:
        if start <= div <= end:
            return (letter, name)
    return (None, None)


def caen_description(cod: Optional[str]) -> Optional[str]:
    """Întoarce descrierea codului CAEN, dacă e cunoscută în nomenclator."""
    if not cod:
        return None
    digits = "".join(ch for ch in str(cod) if ch.isdigit())
    return CAEN_DESCRIERI.get(digits.zfill(4)) or CAEN_DESCRIERI.get(digits)


def enrich_caen(cod: Optional[str]) -> dict[str, Optional[str]]:
    """Toate câmpurile derivate dintr-un cod CAEN."""
    letter, name = caen_section(cod)
    return {
        "caen_descriere": caen_description(cod),
        "caen_sectiune": letter,
        "caen_sectiune_nume": name,
    }
