/**
 * Landenlijst voor klanten- en veilinghuis-feature.
 *
 * Opgeslagen per klant: ISO 3166-1 alpha-3 code (bv. "BEL").
 * Opgeslagen per veilinghuis: vrije tekst (Nederlandse naam typisch),
 * met type-ahead-suggesties uit deze lijst.
 *
 * Voor de vlag-emoji wordt de alpha-2 code (bv. "BE") omgezet naar
 * regional indicator characters.
 *
 * Lijst is samengesteld voor paardenveiling-context: alle Europese
 * landen + grote koper-markten wereldwijd. Niet exhaustief — kan
 * uitgebreid worden indien een klant uit een ontbrekend land komt.
 */

export const COUNTRIES = [
  // Benelux + buurlanden
  { code: 'BEL', alpha2: 'BE', name: 'Belgium',         name_nl: 'België' },
  { code: 'NLD', alpha2: 'NL', name: 'Netherlands',     name_nl: 'Nederland' },
  { code: 'LUX', alpha2: 'LU', name: 'Luxembourg',      name_nl: 'Luxemburg' },
  { code: 'DEU', alpha2: 'DE', name: 'Germany',         name_nl: 'Duitsland' },
  { code: 'FRA', alpha2: 'FR', name: 'France',          name_nl: 'Frankrijk' },
  { code: 'GBR', alpha2: 'GB', name: 'United Kingdom',  name_nl: 'Verenigd Koninkrijk' },
  { code: 'IRL', alpha2: 'IE', name: 'Ireland',         name_nl: 'Ierland' },

  // West-Europa
  { code: 'ESP', alpha2: 'ES', name: 'Spain',           name_nl: 'Spanje' },
  { code: 'PRT', alpha2: 'PT', name: 'Portugal',        name_nl: 'Portugal' },
  { code: 'ITA', alpha2: 'IT', name: 'Italy',           name_nl: 'Italië' },
  { code: 'CHE', alpha2: 'CH', name: 'Switzerland',     name_nl: 'Zwitserland' },
  { code: 'AUT', alpha2: 'AT', name: 'Austria',         name_nl: 'Oostenrijk' },
  { code: 'LIE', alpha2: 'LI', name: 'Liechtenstein',   name_nl: 'Liechtenstein' },
  { code: 'MCO', alpha2: 'MC', name: 'Monaco',          name_nl: 'Monaco' },

  // Noord-Europa / Scandinavië
  { code: 'DNK', alpha2: 'DK', name: 'Denmark',         name_nl: 'Denemarken' },
  { code: 'SWE', alpha2: 'SE', name: 'Sweden',          name_nl: 'Zweden' },
  { code: 'NOR', alpha2: 'NO', name: 'Norway',          name_nl: 'Noorwegen' },
  { code: 'FIN', alpha2: 'FI', name: 'Finland',         name_nl: 'Finland' },
  { code: 'ISL', alpha2: 'IS', name: 'Iceland',         name_nl: 'IJsland' },

  // Oost / Midden-Europa
  { code: 'POL', alpha2: 'PL', name: 'Poland',          name_nl: 'Polen' },
  { code: 'CZE', alpha2: 'CZ', name: 'Czech Republic',  name_nl: 'Tsjechië' },
  { code: 'SVK', alpha2: 'SK', name: 'Slovakia',        name_nl: 'Slowakije' },
  { code: 'HUN', alpha2: 'HU', name: 'Hungary',         name_nl: 'Hongarije' },
  { code: 'SVN', alpha2: 'SI', name: 'Slovenia',        name_nl: 'Slovenië' },
  { code: 'HRV', alpha2: 'HR', name: 'Croatia',         name_nl: 'Kroatië' },
  { code: 'EST', alpha2: 'EE', name: 'Estonia',         name_nl: 'Estland' },
  { code: 'LVA', alpha2: 'LV', name: 'Latvia',          name_nl: 'Letland' },
  { code: 'LTU', alpha2: 'LT', name: 'Lithuania',       name_nl: 'Litouwen' },

  // Zuid-Europa / Balkan
  { code: 'GRC', alpha2: 'GR', name: 'Greece',          name_nl: 'Griekenland' },
  { code: 'BGR', alpha2: 'BG', name: 'Bulgaria',        name_nl: 'Bulgarije' },
  { code: 'ROU', alpha2: 'RO', name: 'Romania',         name_nl: 'Roemenië' },
  { code: 'SRB', alpha2: 'RS', name: 'Serbia',          name_nl: 'Servië' },
  { code: 'BIH', alpha2: 'BA', name: 'Bosnia and Herzegovina', name_nl: 'Bosnië en Herzegovina' },
  { code: 'MNE', alpha2: 'ME', name: 'Montenegro',      name_nl: 'Montenegro' },
  { code: 'MKD', alpha2: 'MK', name: 'North Macedonia', name_nl: 'Noord-Macedonië' },
  { code: 'ALB', alpha2: 'AL', name: 'Albania',         name_nl: 'Albanië' },
  { code: 'CYP', alpha2: 'CY', name: 'Cyprus',          name_nl: 'Cyprus' },
  { code: 'MLT', alpha2: 'MT', name: 'Malta',           name_nl: 'Malta' },
  { code: 'TUR', alpha2: 'TR', name: 'Turkey',          name_nl: 'Turkije' },

  // Oost-Europa / RU + naburig
  { code: 'UKR', alpha2: 'UA', name: 'Ukraine',         name_nl: 'Oekraïne' },
  { code: 'BLR', alpha2: 'BY', name: 'Belarus',         name_nl: 'Wit-Rusland' },
  { code: 'RUS', alpha2: 'RU', name: 'Russia',          name_nl: 'Rusland' },
  { code: 'MDA', alpha2: 'MD', name: 'Moldova',         name_nl: 'Moldavië' },

  // Noord-Amerika
  { code: 'USA', alpha2: 'US', name: 'United States',   name_nl: 'Verenigde Staten' },
  { code: 'CAN', alpha2: 'CA', name: 'Canada',          name_nl: 'Canada' },
  { code: 'MEX', alpha2: 'MX', name: 'Mexico',          name_nl: 'Mexico' },

  // Zuid-Amerika
  { code: 'BRA', alpha2: 'BR', name: 'Brazil',          name_nl: 'Brazilië' },
  { code: 'ARG', alpha2: 'AR', name: 'Argentina',       name_nl: 'Argentinië' },
  { code: 'CHL', alpha2: 'CL', name: 'Chile',           name_nl: 'Chili' },
  { code: 'URY', alpha2: 'UY', name: 'Uruguay',         name_nl: 'Uruguay' },
  { code: 'COL', alpha2: 'CO', name: 'Colombia',        name_nl: 'Colombia' },
  { code: 'PER', alpha2: 'PE', name: 'Peru',            name_nl: 'Peru' },
  { code: 'VEN', alpha2: 'VE', name: 'Venezuela',       name_nl: 'Venezuela' },
  { code: 'ECU', alpha2: 'EC', name: 'Ecuador',         name_nl: 'Ecuador' },

  // Midden-Oosten / Golfstaten (grote koper-markt)
  { code: 'ARE', alpha2: 'AE', name: 'United Arab Emirates', name_nl: 'Verenigde Arabische Emiraten' },
  { code: 'SAU', alpha2: 'SA', name: 'Saudi Arabia',    name_nl: 'Saoedi-Arabië' },
  { code: 'QAT', alpha2: 'QA', name: 'Qatar',           name_nl: 'Qatar' },
  { code: 'KWT', alpha2: 'KW', name: 'Kuwait',          name_nl: 'Koeweit' },
  { code: 'BHR', alpha2: 'BH', name: 'Bahrain',         name_nl: 'Bahrein' },
  { code: 'OMN', alpha2: 'OM', name: 'Oman',            name_nl: 'Oman' },
  { code: 'ISR', alpha2: 'IL', name: 'Israel',          name_nl: 'Israël' },
  { code: 'JOR', alpha2: 'JO', name: 'Jordan',          name_nl: 'Jordanië' },
  { code: 'LBN', alpha2: 'LB', name: 'Lebanon',         name_nl: 'Libanon' },
  { code: 'EGY', alpha2: 'EG', name: 'Egypt',           name_nl: 'Egypte' },

  // Azië
  { code: 'JPN', alpha2: 'JP', name: 'Japan',           name_nl: 'Japan' },
  { code: 'KOR', alpha2: 'KR', name: 'South Korea',     name_nl: 'Zuid-Korea' },
  { code: 'CHN', alpha2: 'CN', name: 'China',           name_nl: 'China' },
  { code: 'HKG', alpha2: 'HK', name: 'Hong Kong',       name_nl: 'Hongkong' },
  { code: 'TWN', alpha2: 'TW', name: 'Taiwan',          name_nl: 'Taiwan' },
  { code: 'SGP', alpha2: 'SG', name: 'Singapore',       name_nl: 'Singapore' },
  { code: 'IND', alpha2: 'IN', name: 'India',           name_nl: 'India' },
  { code: 'THA', alpha2: 'TH', name: 'Thailand',        name_nl: 'Thailand' },
  { code: 'IDN', alpha2: 'ID', name: 'Indonesia',       name_nl: 'Indonesië' },
  { code: 'MYS', alpha2: 'MY', name: 'Malaysia',        name_nl: 'Maleisië' },
  { code: 'PHL', alpha2: 'PH', name: 'Philippines',     name_nl: 'Filipijnen' },
  { code: 'VNM', alpha2: 'VN', name: 'Vietnam',         name_nl: 'Vietnam' },

  // Oceanië
  { code: 'AUS', alpha2: 'AU', name: 'Australia',       name_nl: 'Australië' },
  { code: 'NZL', alpha2: 'NZ', name: 'New Zealand',     name_nl: 'Nieuw-Zeeland' },

  // Afrika (selectief — koper-relevant)
  { code: 'ZAF', alpha2: 'ZA', name: 'South Africa',    name_nl: 'Zuid-Afrika' },
  { code: 'MAR', alpha2: 'MA', name: 'Morocco',         name_nl: 'Marokko' },
  { code: 'TUN', alpha2: 'TN', name: 'Tunisia',         name_nl: 'Tunesië' },
  { code: 'NGA', alpha2: 'NG', name: 'Nigeria',         name_nl: 'Nigeria' },
  { code: 'KEN', alpha2: 'KE', name: 'Kenya',           name_nl: 'Kenia' },
]

// Sorteer alfabetisch op Nederlandse naam
COUNTRIES.sort((a, b) => a.name_nl.localeCompare(b.name_nl, 'nl'))

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]))

export function getCountry(code) {
  if (!code) return null
  return BY_CODE.get(code) ?? null
}

/** Geeft de vlag-emoji voor een ISO 3166-1 alpha-2 code (bv. "BE" → 🇧🇪). */
export function flagEmoji(alpha2) {
  if (!alpha2 || alpha2.length !== 2) return ''
  const base = 0x1f1e6 // Regional Indicator Symbol Letter A
  const a = alpha2.toUpperCase().charCodeAt(0) - 65 // A → 0
  const b = alpha2.toUpperCase().charCodeAt(1) - 65
  if (a < 0 || a > 25 || b < 0 || b > 25) return ''
  return String.fromCodePoint(base + a, base + b)
}

/** Helper: vlag-emoji direct uit alpha-3 code. */
export function flagFromCode(code) {
  const c = getCountry(code)
  return c ? flagEmoji(c.alpha2) : ''
}
