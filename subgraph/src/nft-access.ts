import { BigInt, Address } from "@graphprotocol/graph-ts"
import {
  TransferSingle,
  TransferBatch,
  AccessGranted
} from "../generated/NFTAccess/NFTAccess"
import { Entitlement, Creator, Content, AccessEvent, PlatformStats } from "../generated/schema"

export function handleTransferSingle(event: TransferSingle): void {
  // Only process mints (from zero address) and burns (to zero address)
  let zeroAddress = Address.fromString("0x0000000000000000000000000000000000000000")
  
  if (event.params.from == zeroAddress) {
    // This is a mint - create entitlement
    handleMint(
      event.params.to,
      event.params.id,
      event.params.value,
      event.block.timestamp,
      event.transaction.hash
    )
  } else if (event.params.to == zeroAddress) {
    // This is a burn - deactivate entitlement
    handleBurn(
      event.params.from,
      event.params.id,
      event.params.value,
      event.block.timestamp
    )
  }
}

export function handleTransferBatch(event: TransferBatch): void {
  let zeroAddress = Address.fromString("0x0000000000000000000000000000000000000000")
  
  if (event.params.from == zeroAddress) {
    // Batch mint
    for (let i = 0; i < event.params.ids.length; i++) {
      handleMint(
        event.params.to,
        event.params.ids[i],
        event.params.values[i],
        event.block.timestamp,
        event.transaction.hash
      )
    }
  } else if (event.params.to == zeroAddress) {
    // Batch burn
    for (let i = 0; i < event.params.ids.length; i++) {
      handleBurn(
        event.params.from,
        event.params.ids[i],
        event.params.values[i],
        event.block.timestamp
      )
    }
  }
}

export function handleAccessGranted(event: AccessGranted): void {
  // Create access event for analytics
  let accessEvent = new AccessEvent(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  
  let user = Creator.load(event.params.user.toHexString())
  let content = Content.load(event.params.contentId.toString())
  
  if (user != null && content != null) {
    accessEvent.user = user.id
    accessEvent.content = content.id
    accessEvent.accessType = event.params.accessType
    accessEvent.expiresAt = event.params.expiresAt
    accessEvent.timestamp = event.block.timestamp
    accessEvent.transactionHash = event.transaction.hash
    
    accessEvent.save()
    
    // Update content view count
    content.viewCount = content.viewCount.plus(BigInt.fromI32(1))
    content.updatedAt = event.block.timestamp
    content.save()
  }
}

function handleMint(
  to: Address,
  tokenId: BigInt,
  amount: BigInt,
  timestamp: BigInt,
  txHash: Address
): void {
  let entitlementId = to.toHexString() + "-" + tokenId.toString()
  let entitlement = Entitlement.load(entitlementId)
  
  if (entitlement == null) {
    entitlement = new Entitlement(entitlementId)
    
    // Load user and content
    let user = Creator.load(to.toHexString())
    if (user == null) {
      user = new Creator(to.toHexString())
      user.wallet = to
      user.ageVerified = false
      user.talentVerified = false
      user.totalEarnings = BigInt.fromI32(0)
      user.contentCount = 0
      user.createdAt = timestamp
      user.updatedAt = timestamp
      user.save()
    }
    
    // Decode content ID from token ID (assuming token ID encodes content ID)
    let contentId = tokenId.toString() // Simplified - in practice you'd decode this
    let content = Content.load(contentId)
    
    if (content != null) {
      entitlement.user = user.id
      entitlement.content = content.id
      entitlement.tokenId = tokenId
      entitlement.amount = amount
      entitlement.purchasedAt = timestamp
      entitlement.isActive = true
      
      // Determine access type based on token ID structure
      // This is simplified - in practice you'd have a more sophisticated mapping
      if (tokenId.lt(BigInt.fromI32(1000000))) {
        entitlement.accessType = "ppv"
        entitlement.expiresAt = BigInt.fromI32(0) // No expiry for PPV
        entitlement.priceUSDC = content.priceUSDC
      } else {
        entitlement.accessType = "subscription"
        entitlement.expiresAt = timestamp.plus(BigInt.fromI32(2592000)) // 30 days
        entitlement.priceUSDC = BigInt.fromI32(0) // Subscription price handled separately
      }
      
      entitlement.save()
      
      // Update content sales
      content.totalSales = content.totalSales.plus(entitlement.priceUSDC)
      content.updatedAt = timestamp
      content.save()
      
      // Update platform stats
      updatePlatformStats(timestamp)
    }
  } else {
    // Update existing entitlement
    entitlement.amount = entitlement.amount.plus(amount)
    entitlement.isActive = true
    entitlement.save()
  }
}

function handleBurn(
  from: Address,
  tokenId: BigInt,
  amount: BigInt,
  timestamp: BigInt
): void {
  let entitlementId = from.toHexString() + "-" + tokenId.toString()
  let entitlement = Entitlement.load(entitlementId)
  
  if (entitlement != null) {
    entitlement.amount = entitlement.amount.minus(amount)
    
    if (entitlement.amount.le(BigInt.fromI32(0))) {
      entitlement.isActive = false
    }
    
    entitlement.save()
  }
}

function updatePlatformStats(timestamp: BigInt): void {
  let stats = PlatformStats.load("platform")
  
  if (stats == null) {
    stats = new PlatformStats("platform")
    stats.totalCreators = 0
    stats.totalContent = 0
    stats.totalOrganizations = 0
    stats.totalRevenue = BigInt.fromI32(0)
    stats.totalEntitlements = 0
  }
  
  stats.totalEntitlements = stats.totalEntitlements + 1
  stats.lastUpdated = timestamp
  
  stats.save()
}