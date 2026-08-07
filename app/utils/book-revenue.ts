// Pure fee rules, kept dependency-free and copied verbatim from
// likecoin-api-public — `util/stripe.ts`, `book/price.ts` and `book/payment.ts`
// — so the wizard can show authors the earnings the server will actually settle.
// Both copies run against test/fixtures/book-revenue.golden.json; a rule only
// changes on the server, and the fixture must be regenerated there and re-copied
// here with it, or the two drift. Mirroring is safe only because the ratios are
// policy constants rather than per-environment config; if one ever varies by
// environment, this has to become an endpoint.

export const NFT_BOOK_LIKER_LAND_FEE_RATIO = 0.05
export const NFT_BOOK_TIP_LIKER_LAND_FEE_RATIO = 0.10
export const NFT_BOOK_LIKER_LAND_COMMISSION_RATIO = 0.3
export const NFT_BOOK_LIKER_LAND_ART_FEE_RATIO = 0.1

export const NFT_BOOK_DEFAULT_FROM_CHANNEL = 'liker_land'
export const LIKER_LAND_WAIVED_CHANNEL = 'liker_land_waived'

// Stripe's own cut, as the server estimates it: 2.9% + 30 cents, plus 1.5% for
// international cards and 1% for currency conversion. Hardcoded there too — no
// live rate is ever read — so this mirror is exact, not an approximation of one.
export const STRIPE_PERCENTAGE_FEE = 0.029
export const STRIPE_INTERNATIONAL_FEE = 0.015
export const STRIPE_FX_FEE = 0.01
export const STRIPE_FLAT_FEE = 30

// Only the fields the fee rules read. The server's CartItemWithInfo carries
// stock, images and chain besides; none of them reach the arithmetic.
export type RevenueItem = {
  quantity: number
  priceInDecimal: number
  originalPriceInDecimal: number
  customPriceDiffInDecimal: number
  isLikerLandArt: boolean
  from?: string
}

export type ItemPriceInfo = {
  quantity: number
  currency: string
  priceInDecimal: number
  customPriceDiffInDecimal: number
  originalPriceInDecimal: number
  likerLandTipFeeAmount: number
  likerLandFeeAmount: number
  likerLandCommission: number
  channelCommission: number
  likerLandArtFee: number
}

export type TransactionFeeInfo = {
  priceInDecimal: number
  originalPriceInDecimal: number
  stripeFeeAmount: number
  likerLandTipFeeAmount: number
  likerLandFeeAmount: number
  likerLandCommission: number
  channelCommission: number
  likerLandArtFee: number
  customPriceDiffInDecimal: number
  royaltyToSplit: number
}

export function calculateStripeFee(inputAmount: number, currency = 'usd'): number {
  if (inputAmount === 0) return 0
  const fxFee = currency !== 'usd' ? STRIPE_FX_FEE : 0
  return Math.ceil(
    inputAmount * (STRIPE_PERCENTAGE_FEE + STRIPE_INTERNATIONAL_FEE + fxFee) + STRIPE_FLAT_FEE,
  )
}

export function checkIsFromLikerLand(from: string): boolean {
  return from === NFT_BOOK_DEFAULT_FROM_CHANNEL
}

export function calculateItemPrices(items: RevenueItem[], from?: string): ItemPriceInfo[] {
  return items.map((item) => {
    const isFromLikerLand = checkIsFromLikerLand(item.from || from || '')
    const isFree = !item.priceInDecimal && !item.customPriceDiffInDecimal
    // Deliberately the cart-level `from`, not the item's — the server reads the
    // waiver only from the channel the whole checkout came through.
    const isCommissionWaived = from === LIKER_LAND_WAIVED_CHANNEL
    const customPriceDiffInDecimal = item.customPriceDiffInDecimal || 0
    const { priceInDecimal, originalPriceInDecimal } = item
    const priceInDecimalWithoutTip = priceInDecimal - customPriceDiffInDecimal
    const priceDiscountInDecimal = Math.max(
      originalPriceInDecimal - priceInDecimalWithoutTip,
      0,
    )
    const likerLandFeeAmount = isFree
      ? 0
      : Math.ceil(originalPriceInDecimal * NFT_BOOK_LIKER_LAND_FEE_RATIO)
    const likerLandTipFeeAmount = Math.ceil(
      customPriceDiffInDecimal * NFT_BOOK_TIP_LIKER_LAND_FEE_RATIO,
    )
    const channelCommission = (from && !isCommissionWaived && !isFromLikerLand && !isFree)
      ? Math.max(Math.ceil(
          originalPriceInDecimal * NFT_BOOK_LIKER_LAND_COMMISSION_RATIO - priceDiscountInDecimal,
        ), 0)
      : 0
    const likerLandCommission = (isFromLikerLand && !isFree)
      ? Math.max(Math.ceil(
          originalPriceInDecimal * NFT_BOOK_LIKER_LAND_COMMISSION_RATIO - priceDiscountInDecimal,
        ), 0)
      : 0
    const likerLandArtFee = (item.isLikerLandArt && !isFree)
      ? Math.ceil(originalPriceInDecimal * NFT_BOOK_LIKER_LAND_ART_FEE_RATIO)
      : 0

    return {
      quantity: item.quantity,
      currency: 'usd',
      priceInDecimal,
      customPriceDiffInDecimal,
      originalPriceInDecimal,
      likerLandTipFeeAmount,
      likerLandFeeAmount,
      likerLandCommission,
      channelCommission,
      likerLandArtFee,
    }
  })
}

export function calculateItemFeeInfo(item: ItemPriceInfo, {
  totalStripeFeeAmount,
  totalPriceInDecimal,
}: {
  totalStripeFeeAmount: number
  totalPriceInDecimal: number
}): TransactionFeeInfo {
  const {
    quantity,
    priceInDecimal,
    customPriceDiffInDecimal,
    originalPriceInDecimal,
    likerLandTipFeeAmount,
    likerLandFeeAmount,
    likerLandCommission,
    channelCommission,
    likerLandArtFee,
  } = item
  const stripeFeeAmount = (totalStripeFeeAmount > 0 && totalPriceInDecimal > 0)
    ? Math.ceil((totalStripeFeeAmount * priceInDecimal * quantity) / totalPriceInDecimal)
    : 0
  return {
    stripeFeeAmount,
    priceInDecimal: priceInDecimal * quantity,
    originalPriceInDecimal: originalPriceInDecimal * quantity,
    customPriceDiffInDecimal: customPriceDiffInDecimal * quantity,
    likerLandTipFeeAmount: likerLandTipFeeAmount * quantity,
    likerLandFeeAmount: likerLandFeeAmount * quantity,
    likerLandCommission: likerLandCommission * quantity,
    channelCommission: channelCommission * quantity,
    likerLandArtFee: likerLandArtFee * quantity,
    // stripeFeeAmount is prorated for the whole line (already includes quantity),
    // so subtract it once from the line total, not from the per-unit price.
    royaltyToSplit: Math.max(
      (priceInDecimal
        - likerLandFeeAmount
        - likerLandTipFeeAmount
        - likerLandCommission
        - channelCommission
        - likerLandArtFee) * quantity
        - stripeFeeAmount,
      0,
    ),
  }
}

// --- Wizard-facing wrapper; everything above is the verbatim mirror.

export type AuthorRevenueEstimate = {
  royaltyInDecimal: number
  /** Share of the list price the author keeps, 0–1. */
  ratio: number
}

export type AuthorRevenueByChannel = {
  direct: AuthorRevenueEstimate
  likerLand: AuthorRevenueEstimate
}

// Held here so callers cannot quietly reinvent the fee model.
function estimateChannel(
  priceInDecimal: number,
  currency: string,
  from?: string,
): AuthorRevenueEstimate {
  const [itemPrice] = calculateItemPrices([{
    quantity: 1,
    priceInDecimal,
    originalPriceInDecimal: priceInDecimal,
    customPriceDiffInDecimal: 0,
    isLikerLandArt: false,
  }], from)
  const { royaltyToSplit } = calculateItemFeeInfo(itemPrice!, {
    totalStripeFeeAmount: calculateStripeFee(priceInDecimal, currency),
    totalPriceInDecimal: priceInDecimal,
  })
  return {
    royaltyInDecimal: royaltyToSplit,
    ratio: priceInDecimal > 0 ? royaltyToSplit / priceInDecimal : 0,
  }
}

/**
 * What the author keeps on one sale, by the channel it came through.
 *
 * `direct` is an untagged purchase link — no `from`, so no channel commission.
 * `likerLand` is the 3ook storefront. Both are estimates: the Stripe component
 * is one on the server too.
 */
export function estimateAuthorRevenue(
  priceInDecimal: number,
  currency = 'usd',
): AuthorRevenueByChannel {
  return {
    direct: estimateChannel(priceInDecimal, currency),
    likerLand: estimateChannel(priceInDecimal, currency, NFT_BOOK_DEFAULT_FROM_CHANNEL),
  }
}
