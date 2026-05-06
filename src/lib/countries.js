/**
 * Landenlijst voor klanten-feature (item #8 uit POST_ALOGA_ROADMAP.md).
 *
 * Opgeslagen wordt de ISO 3166-1 alpha-3 code (bv. "BEL"). Voor de
 * vlag-emoji wordt de alpha-2 code (bv. "BE") omgezet naar regional
 * indicator characters.
 *
 * Lijst is samengesteld voor paardenveiling-context: alle Europese
 * landen + grote koper-markten wereldwijd. Niet exhaustief — kan
 * uitgebreid worden indien een klant uit een ontbrekend land komt.
 */

export const COUNTRIES = [
  // Benelux + buurlanden
  { code: 'BEL', alpha2: 'BE', name: 'Belgium' },
  { code: 'NLD', alpha2: 'NL', name: 'Netherlands' },
  { code: 'LUX', alpha2: 'LU', name: 'Luxembourg' },
  { code: 'DEU', alpha2: 'DE', name: 'Germany' },
  { code: 'FRA', alpha2: 'FR', name: 'France' },
  { code: 'GBR', alpha2: 'GB', name: 'United Kingdom' },
  { code: 'IRL', alpha2: 'IE', name: 'Ireland' },

  // West-Europa
  { code: 'ESP', alpha2: 'ES', name: 'Spain' },
  { code: 'PRT', alpha2: 'PT', name: 'Portugal' },
  { code: 'ITA', alpha2: 'IT', name: 'Italy' },
  { code: 'CHE', alpha2: 'CH', name: 'Switzerland' },
  { code: 'AUT', alpha2: 'AT', name: 'Austria' },
  { code: 'LIE', alpha2: 'LI', name: 'Liechtenstein' },
  { code: 'MCO', alpha2: 'MC', name: 'Monaco' },

  // Noord-Europa / Scandinavië
  { code: 'DNK', alpha2: 'DK', name: 'Denmark' },
  { code: 'SWE', alpha2: 'SE', name: 'Sweden' },
  { code: 'NOR', alpha2: 'NO', name: 'Norway' },
  { code: 'FIN', alpha2: 'FI', name: 'Finland' },
  { code: 'ISL', alpha2: 'IS', name: 'Iceland' },

  // Oost / Midden-Europa
  { code: 'POL', alpha2: 'PL', name: 'Poland' },
  { code: 'CZE', alpha2: 'CZ', name: 'Czech Republic' },
  { code: 'SVK', alpha2: 'SK', name: 'Slovakia' },
  { code: 'HUN', alpha2: 'HU', name: 'Hungary' },
  { code: 'SVN', alpha2: 'SI', name: 'Slovenia' },
  { code: 'HRV', alpha2: 'HR', name: 'Croatia' },
  { code: 'EST', alpha2: 'EE', name: 'Estonia' },
  { code: 'LVA', alpha2: 'LV', name: 'Latvia' },
  { code: 'LTU', alpha2: 'LT', name: 'Lithuania' },

  // Zuid-Europa / Balkan
  { code: 'GRC', alpha2: 'GR', name: 'Greece' },
  { code: 'BGR', alpha2: 'BG', name: 'Bulgaria' },
  { code: 'ROU', alpha2: 'RO', name: 'Romania' },
  { code: 'SRB', alpha2: 'RS', name: 'Serbia' },
  { code: 'BIH', alpha2: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'MNE', alpha2: 'ME', name: 'Montenegro' },
  { code: 'MKD', alpha2: 'MK', name: 'North Macedonia' },
  { code: 'ALB', alpha2: 'AL', name: 'Albania' },
  { code: 'CYP', alpha2: 'CY', name: 'Cyprus' },
  { code: 'MLT', alpha2: 'MT', name: 'Malta' },
  { code: 'TUR', alpha2: 'TR', name: 'Turkey' },

  // Oost-Europa / RU + naburig
  { code: 'UKR', alpha2: 'UA', name: 'Ukraine' },
  { code: 'BLR', alpha2: 'BY', name: 'Belarus' },
  { code: 'RUS', alpha2: 'RU', name: 'Russia' },
  { code: 'MDA', alpha2: 'MD', name: 'Moldova' },

  // Noord-Amerika
  { code: 'USA', alpha2: 'US', name: 'United States' },
  { code: 'CAN', alpha2: 'CA', name: 'Canada' },
  { code: 'MEX', alpha2: 'MX', name: 'Mexico' },

  // Zuid-Amerika
  { code: 'BRA', alpha2: 'BR', name: 'Brazil' },
  { code: 'ARG', alpha2: 'AR', name: 'Argentina' },
  { code: 'CHL', alpha2: 'CL', name: 'Chile' },
  { code: 'URY', alpha2: 'UY', name: 'Uruguay' },
  { code: 'COL', alpha2: 'CO', name: 'Colombia' },
  { code: 'PER', alpha2: 'PE', name: 'Peru' },
  { code: 'VEN', alpha2: 'VE', name: 'Venezuela' },
  { code: 'ECU', alpha2: 'EC', name: 'Ecuador' },

  // Midden-Oosten / Golfstaten (grote koper-markt)
  { code: 'ARE', alpha2: 'AE', name: 'United Arab Emirates' },
  { code: 'SAU', alpha2: 'SA', name: 'Saudi Arabia' },
  { code: 'QAT', alpha2: 'QA', name: 'Qatar' },
  { code: 'KWT', alpha2: 'KW', name: 'Kuwait' },
  { code: 'BHR', alpha2: 'BH', name: 'Bahrain' },
  { code: 'OMN', alpha2: 'OM', name: 'Oman' },
  { code: 'ISR', alpha2: 'IL', name: 'Israel' },
  { code: 'JOR', alpha2: 'JO', name: 'Jordan' },
  { code: 'LBN', alpha2: 'LB', name: 'Lebanon' },
  { code: 'EGY', alpha2: 'EG', name: 'Egypt' },

  // Azië
  { code: 'JPN', alpha2: 'JP', name: 'Japan' },
  { code: 'KOR', alpha2: 'KR', name: 'South Korea' },
  { code: 'CHN', alpha2: 'CN', name: 'China' },
  { code: 'HKG', alpha2: 'HK', name: 'Hong Kong' },
  { code: 'TWN', alpha2: 'TW', name: 'Taiwan' },
  { code: 'SGP', alpha2: 'SG', name: 'Singapore' },
  { code: 'IND', alpha2: 'IN', name: 'India' },
  { code: 'THA', alpha2: 'TH', name: 'Thailand' },
  { code: 'IDN', alpha2: 'ID', name: 'Indonesia' },
  { code: 'MYS', alpha2: 'MY', name: 'Malaysia' },
  { code: 'PHL', alpha2: 'PH', name: 'Philippines' },
  { code: 'VNM', alpha2: 'VN', name: 'Vietnam' },

  // Oceanië
  { code: 'AUS', alpha2: 'AU', name: 'Australia' },
  { code: 'NZL', alpha2: 'NZ', name: 'New Zealand' },

  // Afrika (selectief — koper-relevant)
  { code: 'ZAF', alpha2: 'ZA', name: 'South Africa' },
  { code: 'MAR', alpha2: 'MA', name: 'Morocco' },
  { code: 'TUN', alpha2: 'TN', name: 'Tunisia' },
  { code: 'NGA', alpha2: 'NG', name: 'Nigeria' },
  { code: 'KEN', alpha2: 'KE', name: 'Kenya' },
]

// Sorteer alfabetisch op naam
COUNTRIES.sort((a, b) => a.name.localeCompare(b.name))

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
