import { utils, Wallet } from 'ethers'
import { getOrderHash, getTradeHash } from '../../utils/crypto'
import { EXCHANGE_ADDRESS } from '../../config/contracts'
import { round, randInt } from '../../utils/helpers'

export const createRawOrder = async (params, signer) => {
  let order = {}
  let { userAddress, side, pair, amount, price, makeFee, takeFee } = params
  let { baseTokenAddress, quoteTokenAddress } = pair
  let exchangeAddress = EXCHANGE_ADDRESS[signer.provider.network.chainId]

  // The amountPrecisionMultiplier and pricePrecisionMultiplier are temporary multipliers
  // that are used to turn decimal values into rounded integers that can be converted into
  // big numbers that can be used to compute large amounts (ex: in wei) with the amountMultiplier
  // and priceMultiplier. After multiplying with amountMultiplier and priceMultiplier, the result
  // numbers are divided by the precision multipliers.
  // So in the end we have:
  // amountPoints ~ amount * amountMultiplier ~ amount * 1e18
  // pricePoints ~ price * priceMultiplier ~ price * 1e6
  let amountPrecisionMultiplier = 1e6
  let pricePrecisionMultiplier = 1e6
  let amountMultiplier = utils.bigNumberify('1000000000000000000') //1e18
  let priceMultiplier = utils.bigNumberify('1000000') //1e6
  amount = round(amount * amountPrecisionMultiplier, 0)
  price = round(price * pricePrecisionMultiplier, 0)

  let amountPoints = utils
    .bigNumberify(amount)
    .mul(amountMultiplier)
    .div(utils.bigNumberify(amountPrecisionMultiplier))
  let pricePoints = utils
    .bigNumberify(price)
    .mul(priceMultiplier)
    .div(utils.bigNumberify(pricePrecisionMultiplier))

  order.userAddress = userAddress
  order.exchangeAddress = exchangeAddress
  order.buyToken = side === 'BUY' ? baseTokenAddress : quoteTokenAddress
  order.buyAmount =
    side === 'BUY'
      ? amountPoints.toString()
      : amountPoints
          .mul(pricePoints)
          .div(priceMultiplier)
          .toString()
  order.sellToken = side === 'BUY' ? quoteTokenAddress : baseTokenAddress
  order.sellAmount =
    side === 'BUY'
      ? amountPoints
          .mul(pricePoints)
          .div(priceMultiplier)
          .toString()
      : amountPoints.toString()
  order.makeFee = makeFee
  order.takeFee = takeFee
  order.nonce = randInt(0, 1e16).toString()
  order.expires = '10000000000000'
  order.hash = getOrderHash(order)

  let signature = await signer.signMessage(utils.arrayify(order.hash))
  let { r, s, v } = utils.splitSignature(signature)
  order.signature = { R: r, S: s, V: v }

  return order
}

export const validateOrderHash = async (hash, order) => {
  let computedHash = getOrderHash(order)

  return computedHash !== hash ? false : true
}

export const validateTradeHash = async (hash, trade) => {
  let computedHash = getTradeHash(trade)

  return computedHash !== hash ? false : true
}

// We currently assume that the order is already signed
export const signOrder = async (signer, order) => {
  let computedHash = getOrderHash(order)
  if (order.hash !== computedHash) throw new Error('Invalid Hash')

  let signature = await signer.signMessage(utils.arrayify(order.hash))
  let { r, s, v } = utils.splitSignature(signature)

  order.signature = { R: r, S: s, V: v }
  return order
}

export const signTrade = async (signer, trade) => {
  let computedHash = getTradeHash(trade)
  if (trade.hash !== computedHash) throw new Error('Invalid Hash')

  let signature = await signer.signMessage(utils.arrayify(trade.hash))
  let { r, s, v } = utils.splitSignature(signature)

  trade.signature = { R: r, S: s, V: v }
  return trade
}
