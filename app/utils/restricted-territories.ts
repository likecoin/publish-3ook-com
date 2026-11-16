// ISO 3166-1 alpha-2, in lockstep with likecoin-api-public's ISO_ALPHA2_COUNTRY_CODES,
// which rejects the whole listing request on a code it does not know.
export const TERRITORY_CODES = [
  'AF', 'AX', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU', 'AT',
  'AZ', 'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BQ', 'BA', 'BW',
  'BV', 'BR', 'IO', 'BN', 'BG', 'BF', 'BI', 'CV', 'KH', 'CM', 'CA', 'KY', 'CF', 'TD', 'CL',
  'CN', 'CX', 'CC', 'CO', 'KM', 'CG', 'CD', 'CK', 'CR', 'CI', 'HR', 'CU', 'CW', 'CY', 'CZ',
  'DK', 'DJ', 'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FK', 'FO', 'FJ',
  'FI', 'FR', 'GF', 'PF', 'TF', 'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL', 'GD', 'GP',
  'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'VA', 'HN', 'HK', 'HU', 'IS', 'IN', 'ID',
  'IR', 'IQ', 'IE', 'IM', 'IL', 'IT', 'JM', 'JP', 'JE', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KR',
  'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO', 'MG', 'MW', 'MY',
  'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS',
  'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF', 'MK',
  'MP', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PT', 'PR',
  'QA', 'RE', 'RO', 'RU', 'RW', 'BL', 'SH', 'KN', 'LC', 'MF', 'PM', 'VC', 'WS', 'SM', 'ST',
  'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'SS', 'ES',
  'LK', 'SD', 'SR', 'SJ', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TK', 'TO',
  'TT', 'TN', 'TR', 'TM', 'TC', 'TV', 'UG', 'UA', 'AE', 'GB', 'US', 'UM', 'UY', 'UZ', 'VU',
  'VE', 'VN', 'VG', 'VI', 'WF', 'EH', 'YE', 'ZM', 'ZW',
]

const TERRITORY_CODE_SET = new Set(TERRITORY_CODES)

// Listed first in the picker: the markets where a publisher most often lacks the rights.
export const COMMON_TERRITORY_CODES = ['HK', 'CN', 'TW']

export type RestrictedTerritoriesSource = 'review' | 'admin' | 'publisher'

// Format check only: expanding HK to HK + CN is left to the API.
export function parseTerritoryCodes(value: string | undefined): { codes: string[], invalidCodes: string[] } {
  const tokens = [...new Set(
    (value || '').split(/[,，、\s]+/).map(token => token.trim().toUpperCase()).filter(Boolean),
  )]
  return {
    codes: tokens.filter(code => TERRITORY_CODE_SET.has(code)),
    invalidCodes: tokens.filter(code => !TERRITORY_CODE_SET.has(code)),
  }
}

// Mirrors the API: only a publisher-set geoblock is editable.
// One with no source predates the field, when only review or an admin could set it.
export function isRestrictedTerritoriesLocked(listing: {
  restrictedTerritories?: string[]
  restrictedTerritoriesSetBy?: RestrictedTerritoriesSource
}): boolean {
  return (
    !!listing.restrictedTerritories?.length
    && listing.restrictedTerritoriesSetBy !== 'publisher'
  )
}

// "香港 (HK)": the code is what a CSV takes, so the picker teaches it.
export function createTerritoryLabeler(locale: string): (code: string) => string {
  // zh's long names spell out 中國香港特別行政區; the short ones read 香港.
  const displayNames = new Intl.DisplayNames([locale], {
    type: 'region',
    style: locale.startsWith('zh') ? 'short' : 'long',
  })
  return code => `${displayNames.of(code) || code} (${code})`
}

export function getTerritoryOptions(locale: string): { value: string, label: string }[] {
  const getLabel = createTerritoryLabeler(locale)
  const toOption = (code: string) => ({ value: code, label: getLabel(code) })
  const others = TERRITORY_CODES
    .filter(code => !COMMON_TERRITORY_CODES.includes(code))
    .map(toOption)
    .sort((a, b) => a.label.localeCompare(b.label, locale))
  return [...COMMON_TERRITORY_CODES.map(toOption), ...others]
}
