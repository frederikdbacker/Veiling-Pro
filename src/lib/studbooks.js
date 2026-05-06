/**
 * Stamboeken voor hengst-keuring (item #11 uit POST_ALOGA_ROADMAP.md).
 *
 * Volgorde: 7 veelgebruikte stamboeken eerst (in voorgestelde volgorde
 * uit roadmap), daarna de overige alfabetisch. Alles in HOOFDLETTERS
 * zoals in de roadmap vastgelegd.
 */

const PRIORITY = ['BWP', 'KWPN', 'SBS', 'HANN', 'OLD', 'SF', 'Z']

const REST_ALPHABETICAL = [
  'AES', 'AWHA', 'BAD-WU', 'BE/SIES', 'BH', 'CCDM', 'CDE', 'DSP', 'DWB',
  'ESHB', 'ISH', 'MV', 'NRPS', 'NWB', 'OS', 'PZHK', 'RHEIN', 'SATHU',
  'SCSL', 'SI', 'SLS', 'SWB', 'WEST', 'ZFDP',
]

export const STUDBOOKS = [...PRIORITY, ...REST_ALPHABETICAL]
