#!/usr/bin/env python3
"""
Eenmalig data-enrichment voor Aloga Auction 2026: vult de 17 lots aan
met studbook, size, catalog_text, equiratings_text en photos uit
aloga-auction.com (gescrapet via WebFetch op 2026-04-30 — onze april-import
miste deze velden door een rendering-issue).

Filtert ook de overeenkomstige keys uit lots.missing_info zodat de
banner/badge in de UI zich aanpast.

Gebruik:
    node --env-file=.env.local --eval "process.exit(0)"  # alleen om env te kopiëren
    set -a && source .env.local && set +a
    python3 scripts/aloga-2026-enrich.py

Of in één klap:
    bash -c 'set -a && source .env.local && set +a && python3 scripts/aloga-2026-enrich.py'
"""

import json
import os
import ssl
import sys
import urllib.request
import urllib.parse

# Python 3.14 op macOS heeft geen system CA bundle — bypass voor deze one-shot.
# Veilig hier omdat we tegen onze eigen Supabase-instance praten.
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

URL = os.environ.get('VITE_SUPABASE_URL')
KEY = os.environ.get('VITE_SUPABASE_PUBLISHABLE_KEY')

if not URL or not KEY:
    print('❌ Env vars VITE_SUPABASE_URL en VITE_SUPABASE_PUBLISHABLE_KEY ontbreken.')
    print('   Run met: set -a && source .env.local && set +a && python3 scripts/aloga-2026-enrich.py')
    sys.exit(1)

KEYS_TO_CLEAR = ['studbook', 'size', 'catalog_text', 'equiratings_text', 'photos']

DATA = {
    'amaretto-destinys': {
        'size': 'Medium',
        'studbook': 'ZANG',
        'catalog_text': "Amaretto Destiny's is a picture-perfect 5-year-old approved stallion from Zangersheide. A very handsome young horse, he combines presence with a beautiful, eye-catching way of jumping. He is also among the first crops of Denis Lynch's exciting stallion All Star 5, making him an especially interesting prospect for both sport and breeding.",
        'equiratings_text': "Amaretto Destiny's is a son of the incredible All Star 5. Paired with Denis Lynch, All Star 5 was a part of Irish team that won Team Gold at the 2017 European Championships in Gothenburg. Throughout his career, he reached a peak Elo rating of 760, which puts him firmly among the Top 8 highest-rated Irish horses of all time on the EquiRatings records.",
        'photos': [
            "https://www.aloga-auction.com/uploads/stallions/pictures/amarettos-destiny-photos-17750321241701.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/amarettos-destiny-photos-17750321241981.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/amarettos-destiny-photos-17750321247562.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/amarettos-destiny-photos-17751160543421.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/amarettos-destiny-photos-17751160542845.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/amarettos-destiny-photos-17751160546454.jpg",
        ],
    },
    'annabelle': {
        'size': 'Medium',
        'studbook': 'OS',
        'catalog_text': "Annabelle is an 8-year-old mare that truly fights for her rider. At only 8 years old, she has already successfully competed up to 1.45m level and shows all the quality for the bigger tracks. She gives her rider a fantastic feeling in the ring and is a horse that always tries to help her rider. Her rideability and mindset make her a very enjoyable partner, both in the ring and in daily training. She is also very kind, easy in the stable and a pleasure to work with every day.",
        'equiratings_text': "Annabelle's dam Constanze 41 competed successfully up to 140 national level in Germany. Her sire, Aganix du Seigneur, is one of the most popular sires in modern breeding and has multiple offspring competing at the highest level of our sport, including Ambassador Z, winner of the 1.5M LGCT Grand Prix of Monte Carlo.",
        'photos': [
            "https://www.aloga-auction.com/uploads/stallions/pictures/annabelle-photos-17750627269010.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/annabelle-photos-17750627373031.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/annabelle-photos-17750627376949.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/annabelle-photos-17750627569292.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/annabelle-photos-17750627562829.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/annabelle-photos-17750627563044.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/annabelle-photos-17750627569899.jpg",
        ],
    },
    'california': {
        'size': 'Medium',
        'studbook': 'ISH',
        'catalog_text': "Homebred at Aloga Stables Ireland, California is a 6-year-old mare who has impressed us consistently since the age of 4. She appears to carry many of the best attributes of her sire Cardento, who has produced horses such as Kilkenny and Katanga V/H Dingeshof. She jumps with real ease and shows an abundance of scope, always giving a confident feeling to her rider.",
        'equiratings_text': "California was already impressive on the national circuit in Ireland last year, jumping triple clear in the Cavan Indoor Championships for 5-year-olds to finish as the runner-up. Her 6-year-old career is off to a strong start with 4 clears from 5 rounds in the international young horse classes in Kronenberg. California shares a damline with Pieter Devos' Claire Z, winners of the 2019 LGCT Grand Prix of Miami Beach.",
        'photos': [
            "https://www.aloga-auction.com/uploads/stallions/pictures/california-photos-17750329044314.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/california-photos-17750329042944.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/california-photos-17750329043854.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/california-photos-17751157879744.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/california-photos-17751158111461.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/california-photos-17751158115987.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/california-photos-17751158118001.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/california-photos-17751158112579.jpg",
        ],
    },
    'caprice': {
        'size': 'Medium',
        'studbook': 'ZANG',
        'catalog_text': "Caprice is a 6-year-old mare in whom the whole team has a great deal of belief. She has a genuine desire to please, always giving her rider a very good feeling. She consistently tries her utmost to jump clear, a quality every rider appreciates as they canter into the ring. We are very excited to see what she can achieve in the sport.",
        'equiratings_text': "Caprice started her international career in 2025 and produced a clear round in the 5-year-old World Championships under Stephanie Bollen. She has had a successful start to her 6-year-old season by maintaining an 80% clear rate under Abbie Sweetnam. She is a daughter of Colorit Z, 2013 winner of the World Cup of 's Hertogenbosch under David Will.",
        'photos': [
            "https://www.aloga-auction.com/uploads/stallions/pictures/caprice-photos-17750333297674.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/caprice-photos-17750333296765.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/caprice-photos-17750333295341.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/caprice-photos-17750673362098.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/caprice-photos-17750673367723.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/caprice-photos-17750673368599.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/caprice-photos-17750673362714.jpg",
        ],
    },
    'chacco-for-freedom': {
        'size': 'Large',
        'studbook': 'OS',
        'catalog_text': "Chacco for Freedom is a 7-year-old gelding who is a horse the team believes has all the qualities to develop into a top Grand Prix contender. He has a wonderfully relaxed attitude, in which very little seems to phase him, and no matter the height, he jumps with natural ease giving his rider a consistently reassuring feeling. As he continues to develop, he shows all the signs of a horse with a very exciting future ahead.",
        'equiratings_text': "Chacco for Freedom is a son of Tannenhof's Chacco Chacco, who also sired the 2022 Dublin Grand Prix winner Gamin van't Naastveldhof. Chacco for Freedom has shown great promise on the international scene jumping 7 clear rounds across Bedizolle and Kronenberg.",
        'photos': [
            "https://www.aloga-auction.com/uploads/stallions/pictures/chacco-for-freedom-photos-17750576547958.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/chacco-for-freedom-photos-17750576541382.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/chacco-for-freedom-photos-17750576542736.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/chacco-for-freedom-photos-17750698982179.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/chacco-for-freedom-photos-17750699245020.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/chacco-for-freedom-photos-17750699246199.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/chacco-for-freedom-photos-17750699242516.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/chacco-for-freedom-photos-17750699242398.jpg",
        ],
    },
    'ella-gold': {
        'size': 'Medium',
        'studbook': 'HANN',
        'catalog_text': "Ella Gold is an 8-year old mare has developed into one of Aloga Stables' most consistent and very exciting 8-year-old's. Since joining the team as a 7-year-old she has been incredible with her Equiratings insights reflecting just how consistent she really is. She is a mare who always wants to please, approaching her work with a genuine attitude and in the ring, she combines carefulness with a lovely way of going, while continuing to show all the qualities needed for the next level.",
        'equiratings_text': "Ella Gold has started her 8-year-old season off very successfully with 18 clears from 20 international rounds so far this season, most notably in Oliva, Opglabbeek and Kronenberg. This gives her an exceptional 90% clear rate so far this year and ranks her among the 1% best international 8-year-old horses of the year so far. Ella Gold's sire Eldorado van de Zeshoek is the most represented sire with 4 offspring in the Top 35 rated horses according to the EquiRatings Elo rating in April 2026.",
        'photos': [
            "https://www.aloga-auction.com/uploads/stallions/pictures/ella-gold-photos-17750369887599.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/ella-gold-photos-17750369885519.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/ella-gold-photos-17750369882397.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/ella-gold-photos-17750707674476.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/ella-gold-photos-17750707675056.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/ella-gold-photos-17750707673123.jpg",
        ],
    },
    'fire-soul': {
        'size': 'Medium',
        'studbook': 'OLDBG',
        'catalog_text': "With Fire Soul, a truly exceptional young stallion enters the stage. Already as a foal he captivated us with his outstanding quality of movement, his striking, expressive type and his magnificent, bushy presence. From the very beginning he was a horse that naturally drew attention and left a lasting impression. Now four years old, Fire Soul has fully confirmed these early promises. Under saddle he impresses with excellent rideability and natural balance. His outstanding trot, featuring impressive elasticity, freedom of the shoulder and powerful hindleg activity, immediately catches the eye. Equally remarkable is his uphill, expressive canter, full of scope and cadence. Beyond his spectacular movement, Fire Soul convinces with an exceptionally pleasant ride and a confident, harmonious way of going under saddle. His elegant silhouette, noble black coat and charismatic presence give him an unforgettable appearance. A modern dressage stallion with exceptional movement potential, outstanding rideability and captivating beauty — a horse destined for a bright future!",
        'equiratings_text': None,
        'photos': [
            "https://www.aloga-auction.com/uploads/stallions/pictures/fire-soul-photos-17732289449024.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/fire-soul-photos-17732300119889.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/fire-soul-photos-17732300114566.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/fire-soul-photos-17732300475847.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/fire-soul-photos-17732301188077.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/fire-soul-photos-17732301188482.jpg",
        ],
    },
    'gagliardo': {
        'size': 'Large',
        'studbook': 'ZANG',
        'catalog_text': "Gagliardo da Emilio DB Z is a 5-year-old gelding by Gaillard de la Pomme, showing all the hallmarks of an exceptional hunter prospect. He has some of the very best attributes a modern day hunter needs an elegant type with natural balance, rhythm, and a beautifully consistent way of going. His effortless style, smooth jump, and classic technique make him ideally suited for the hunter ring, while his rideability and presence set him apart as a future blue ribbon winner. We have mo doubt he has all the ingredients to develop into a top hunter champion at the highest level.",
        'equiratings_text': "Gagliardo is a son of Gaillard de la Pomme, a prominent sire from the famous Qerly Chin damline. He also sired 2023 Asian Games Individual Gold medal winner, G's Fabian, and the 2024 Rolex Grand Prix of Brussels winner, Finn Lente, the all-time highest-ranked Argentian horse on the EquiRatings Elo rating.",
        'photos': [
            "https://www.aloga-auction.com/uploads/stallions/pictures/gagliardo-photos-17750635218848.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/gagliardo-photos-17750635441644.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/gagliardo-photos-17750635444681.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/gagliardo-photos-17750635605135.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/gagliardo-photos-17750635619972.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/gagliardo-photos-17750635619565.jpg",
        ],
    },
    'hickstead-houdini': {
        'size': 'Medium',
        'studbook': 'OLDN',
        'catalog_text': "Hickstead Houdini is a 6-year-old gelding by Hickstead White. He combines an elegant type with a balanced and rhythmic way of going. His kind nature and easy-going attitude make him particularly suitable for amateurs, while his quality and talent ensure he has all the attributes for a successful future in the sport particularly in the hunter ring. We believe he is a horse who will develop into a reliable and competitive partner, and one who will quickly become a favourite in his new home.",
        'equiratings_text': "Hicksteads Houdini is a son of multiple international winner Hickstead White and a grandson of Carinjo HDC, who finished on the podium of the prestigious Grand Prix of Aachen in 2012.",
        'photos': [
            "https://www.aloga-auction.com/uploads/stallions/pictures/hickstead-houdini-photos-17750446596363.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/hickstead-houdini-photos-17750446596693.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/hickstead-houdini-photos-17750446591712.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/hickstead-houdini-photos-17750709716553.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/hickstead-houdini-photos-17750709894414.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/hickstead-houdini-photos-17750709891232.jpg",
        ],
    },
    'jellycat': {
        'size': 'Large',
        'studbook': 'SF',
        'catalog_text': "Jellycat is a 7-year-old mare from Philippe Le Jeune's world champion stallion Vigo D'Arsouilles and has been with Aloga Stables since she was a 6-year-old, having been purchased directly from her breeder in France. She has been produced patiently, always with the belief that she could develop into a true Grand Prix horse. She shows an abundance of scope, and very little ever phases her, giving the impression that there is much more to come.",
        'equiratings_text': "Jellycat des Etangs is a direct daughter of the 2010 Jumping World Champion, Vigo d'Arsouilles. She has started off her international 7-year-old season in Bedizzole, Italy, where she has maintained an above average clear rate of 86% with 6 clears from 7 rounds jumped so far. This is an extention of her success as a 6-year-old last year, where her 7 clears from 8 international rounds put her firmly among the best 5% of international 6-year-olds in 2025.",
        'photos': [
            "https://www.aloga-auction.com/uploads/stallions/pictures/jellycat-photos-17750356622523.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/jellycat-photos-17750356623882.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/jellycat-photos-17750356628160.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/jellycat-photos-17750697086123.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/jellycat-photos-17750697899537.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/jellycat-photos-17750697894117.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/jellycat-photos-17750697898135.jpg",
        ],
    },
    'lordswood-dancing-diamond-iii': {
        'size': 'Large',
        'studbook': 'HANN',
        'catalog_text': "Lordswood Dancing Diamond III combines exceptional rideability, athletic power and a pedigree proven at the highest level of international dressage sport. This outstanding gelding presents three remarkable basic gaits. His walk is relaxed, clear and ground covering. The trot is expressive and elastic with powerful engagement from behind and impressive freedom through the shoulder. His canter is naturally uphill, balanced and full of scope – an ideal foundation for the development of advanced dressage work. What truly distinguishes him is his exceptional character. He is focused, reliable and always eager to perform for his rider, yet remains calm and uncomplicated in every situation. This combination of quality and mentality makes him a true partner for ambitious riders. His talent for collection is already clearly visible. He demonstrates promising beginnings of piaffe and passage, revealing the strength and balance required for the highest level of the sport. His pedigree further confirms his extraordinary potential. His full brother, Lordswood Dancing Diamond, won the Bundeschampionat as a five year old and became World Champion as a six year old before later achieving Grand Prix victories under Dorothee Schneider. Lordswood Dancing Diamond III has also proven his quality in competition and successfully qualified for the Bundeschampionat for seven year olds with scores close to 75 percent. With his powerful movement, outstanding rideability and proven genetics, he represents a serious Grand Prix prospect for the future.",
        'equiratings_text': None,
        'photos': [
            "https://www.aloga-auction.com/uploads/stallions/pictures/lordswood-dancing-diamond-photos-17732276943042.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/lordswood-dancing-diamond-photos-17732277239455.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/lordswood-dancing-diamond-photos-17732277479745.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/lordswood-dancing-diamond-photos-17736534563942.jpg",
        ],
    },
    'master-of-paradise': {
        'size': 'Medium',
        'studbook': 'HOLST',
        'catalog_text': "Master of Paradise is a stunning 7-year-old stallion who joined Aloga Stables as a 6-year-old, a year in which he finished second at the renowned Bundeschampionat in Germany with Patrick Bölle. Maxi took over the ride towards the end of that year, and since then he has been held in very high regard by everyone who rides him. The ease with which he jumps and the feeling he gives are truly something special and we have no doubt that he has the ability to achieve a lot in his career.",
        'equiratings_text': "Master of Paradise started his international season off well in the 7-year-old classes in Bedizzole, only knocking one rail over 8 rounds of jumping, which means this son of Manchester van't Paradijs performs well above his average peers. Last year, Master of Paradise finished second in both Qualifiers of the 6-year-old Bundeschampionat in Warendorf on exceptional scores of 8.8 and 8.7 respectively.",
        'photos': [
            "https://www.aloga-auction.com/uploads/stallions/pictures/master-of-paradise-photos-17750567619071.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/master-of-paradise-photos-17750567613288.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/master-of-paradise-photos-17750567617521.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/master-of-paradise-photos-17750681575180.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/master-of-paradise-photos-17750683357002.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/master-of-paradise-photos-17750683351003.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/master-of-paradise-photos-17750683354682.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/master-of-paradise-photos-17750683352958.jpg",
        ],
    },
    'orient-o': {
        'size': 'Medium',
        'studbook': 'KWPN',
        'catalog_text': "Orient-O is a 7-year-old for whom the team has extremely high hopes. Purchased as a 6-year-old, he was quietly and carefully produced before heading to the Sunshine Tour this spring, where he was nothing short of extraordinary. The way he jumped and progressed there was a clear sign of a horse with the ability to go all the way.",
        'equiratings_text': "Orient-O has started the 2026 season of at the Andalucia Sunshine Tour in Vejer de la Frontera by maintaining a 79% clear over the international 7-year-old classes from 14 rounds.",
        'photos': [
            "https://www.aloga-auction.com/uploads/stallions/pictures/orient-o-photos-17750396661324.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/orient-o-photos-17750396667806.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/orient-o-photos-17750396665186.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/orient-o-photos-17750702779306.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/orient-o-photos-17750702955535.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/orient-o-photos-17750702956897.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/orient-o-photos-17750702958426.jpg",
        ],
    },
    'orpheus': {
        'size': 'Medium',
        'studbook': 'KWPN',
        'catalog_text': "Orpheus is an amazing 7-year-old stallion who has been an Aloga Stables member since his 6-year-old year. He has always given the impression of being something quite special, the excitement he brings to his riders is unmistakable, combined with a kind and genuine temperament at home. In the ring, the feeling he gives is often described as something truly rare and genuinely believe that Orpheus can really go all the way",
        'equiratings_text': "Orpheus has had an almost perfect start to his international 7-year-old season. From 9 rounds in the 7-year-old classes at Bedizzole, Italy, he did not knock a single rail, but did incur time penalties in one round to account for their current international clear rate of 89%.",
        'photos': [
            "https://www.aloga-auction.com/uploads/stallions/pictures/orpheus-photos-17750352411825.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/orpheus-photos-17750352414850.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/orpheus-photos-17750352419567.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/orpheus-photos-17750694025416.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/orpheus-photos-17750694319515.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/orpheus-photos-17750694313110.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/orpheus-photos-17750694314027.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/orpheus-photos-17750694318385.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/orpheus-photos-17750694311613.jpg",
        ],
    },
    'tochinsky': {
        'size': 'Medium',
        'studbook': 'BWP',
        'catalog_text': "You only need to look at Tochinsky's pedigree to imagine what he may achieve. A beautiful 7-year-old stallion, he has been quite outstanding in the ring. He has this wonderful way of jumping, where you can see the best qualities of both his father Cornet Obolensky and his grandfather Emerald. We are very confident that he has all the attributes of a future Grand Prix horse. Infact we have no doubt.",
        'equiratings_text': "Across 2025 and 2026, Tochinsky has jumped 20 international rounds in the 6 and 7-year-old categories, keeping a zero scoreboard in 15 and maintaining a clear rate of 75%. In March, this son of Cornet Obolensky has been active in Beddizole, Italy, where he jumped exclusively clear rounds during his last week there. Tochinsky's dam, Emerine Z, is currently still active in the sport and has been very competitive in the 140 and 145 classes in 2025 with U25 rider Guillaume Gillioz and most recently competed in the CSI5* of 's Hertogenbosch under Henrik von Eckermann.",
        'photos': [
            "https://www.aloga-auction.com/uploads/stallions/pictures/tochinsky-photos-17750581845253.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/tochinsky-photos-17750581978460.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/tochinsky-photos-17750581971356.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/tochinsky-photos-17751161763980.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/tochinsky-photos-17751161765417.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/tochinsky-photos-17751161767001.jpg",
        ],
    },
    'total-secret': {
        'size': 'Medium',
        'studbook': 'DSP',
        'catalog_text': "Total Secret represents the modern elite dressage stallion powerful, elegant and unmistakably charismatic. This licensed black stallion captivates from the very first moment with his noble expression, impressive presence and natural self carriage. His movement mechanics reveal extraordinary potential for the highest levels of dressage. The walk is clear, relaxed and ground covering with excellent suppleness through the body. In trot, Total Secret demonstrates remarkable elasticity, impressive shoulder freedom and powerful engagement from the hind leg. His canter is naturally uphill, balanced and full of cadence a canter that already hints at future collection. His pedigree adds further distinction. Total Secret descends from the exceptional dam line that also produced the dressage stallions Van Vivaldi I and Van Vivaldi II. The dam herself was bred by the renowned Rothenberger family, a name deeply connected with international dressage excellence. In addition to his athletic ability, Total Secret impresses with an outstanding character. Intelligent, cooperative and highly rideable, he consistently offers his rider a harmonious and confident feeling under saddle. With his combination of modern type, expressive movement and proven genetics, Total Secret presents a rare opportunity for ambitious riders and breeders alike a stallion with the quality and charisma required for the international stage.",
        'equiratings_text': None,
        'photos': [
            "https://www.aloga-auction.com/uploads/stallions/pictures/total-secret-photos-17732260086933.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/total-secret-photos-17732260627215.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/total-secret-photos-17732260894826.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/total-secret-photos-17736486922361.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/total-secret-photos-17736486921121.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/total-secret-photos-17736486928268.jpg",
        ],
    },
    'valsero': {
        'size': 'Medium',
        'studbook': 'HANN',
        'catalog_text': "Valsero is a young dressage horse who embodies athleticism, presence and exceptional promise for the future. This four year old gelding immediately impresses with his natural balance, expressive movement and remarkable willingness to perform. He is a son of the premium stallion Venido, successful up to Prix St. Georges level, and out of the mare Fortuna by Finnigan. Through this dam line he is closely related to the Grand Prix successful Don Lauris a pedigree clearly shaped by proven sport performance. Valsero particularly captivates in the trot. With extraordinary shoulder freedom, impressive elasticity and dynamic engagement from the hind leg, his movement already reveals the qualities required for future collected work. His canter is powerful, uphill and full of scope, while the walk remains pure in rhythm with generous overtrack and relaxation. Equally remarkable is his attitude towards work. Valsero approaches every task with motivation and focus, creating a feeling of harmony and partnership for his rider. His natural talent combined with his positive mentality makes him an exciting prospect for the sport. Valsero is a horse whose quality speaks for itself, a future partner for riders aiming for the highest levels of dressage competition.",
        'equiratings_text': None,
        'photos': [
            "https://www.aloga-auction.com/uploads/stallions/pictures/valsero-photos-17732284075697.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/valsero-photos-17732284078167.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/valsero-photos-17732284795659.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/valsero-photos-17736510109646.jpg",
            "https://www.aloga-auction.com/uploads/stallions/pictures/valsero-photos-17736510245671.jpg",
        ],
    },
}


def req(method, path, body=None):
    headers = {
        'apikey': KEY,
        'Authorization': f'Bearer {KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    }
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(URL + path, data=data, method=method, headers=headers)
    with urllib.request.urlopen(r, context=SSL_CTX) as resp:
        text = resp.read().decode()
        return json.loads(text) if text else []


def main():
    print(f'\n📦 Aloga 2026 enrichment — {len(DATA)} paarden\n')
    success = 0
    for slug, fields in DATA.items():
        rows = req('GET', f'/rest/v1/lots?slug=eq.{slug}&select=id,name,missing_info')
        if not rows:
            print(f'⚠ slug "{slug}" niet in DB — overgeslagen')
            continue
        lot = rows[0]
        current_missing = lot.get('missing_info') or []
        new_missing = [k for k in current_missing if k not in KEYS_TO_CLEAR]

        # Bouw payload — laat None-velden weg zodat we niets per ongeluk wissen
        payload = {k: v for k, v in fields.items() if v is not None}
        # equiratings_text=None betekent: niet aanwezig, maar als de DB hem al
        # had moeten we hem niet wissen. Skippen is dus prima.
        payload['missing_info'] = new_missing

        result = req('PATCH', f'/rest/v1/lots?id=eq.{lot["id"]}', payload)
        if result:
            n_photos = len(fields.get('photos') or [])
            extra = ', equirat=NONE' if fields.get('equiratings_text') is None else ''
            print(f'✅ {lot["name"]:32} {fields["studbook"]:6} {fields["size"]:6} {n_photos} foto\'s{extra}')
            print(f'   missing_info nu: {new_missing}')
            success += 1

    print(f'\n{success}/{len(DATA)} succesvol bijgewerkt\n')


if __name__ == '__main__':
    main()
