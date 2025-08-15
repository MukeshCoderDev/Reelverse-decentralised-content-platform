import { BigInt } from "@graphprotocol/graph-ts"
import {
  ContentRegistered,
  ModerationStatusUpdated,
  ContentPriceUpdated
} from "../generated/ContentRegistry/ContentRegistry"
import { Content, Creator, ModerationEvent, PlatformStats } from "../generated/schema"

export function handleContentRegistered(event: ContentRegistered): void {
  let content = new Content(event.params.contentId.toString())
  
  // Load or create creator
  let creator = Creator.load(event.params.creator.toHexString())
  if (creator == null) {
    creator = new Creator(event.params.creator.toHexString())
    creator.wallet = event.params.creator
    creator.ageVerified = false
    creator.talentVerified = false
    creator.totalEarnings = BigInt.fromI32(0)
    creator.contentCount = 0
    creator.createdAt = event.block.timestamp
    creator.updatedAt = event.block.timestamp
  }
  
  // Update creator content count
  creator.contentCount = creator.contentCount + 1
  creator.updatedAt = event.block.timestamp
  creator.save()
  
  // Set content properties
  content.creator = creator.id
  content.metaURI = event.params.metaURI
  content.perceptualHash = event.params.perceptualHash
  content.priceUSDC = event.params.priceUSDC
  content.storageClass = event.params.storageClass
  content.moderationStatus = 0 // Pending by default
  content.splitter = event.params.splitter
  content.geoMask = event.params.geoMask
  content.totalSales = BigInt.fromI32(0)
  content.viewCount = BigInt.fromI32(0)
  content.createdAt = event.block.timestamp
  content.updatedAt = event.block.timestamp
  
  content.save()
  
  // Update platform stats
  updatePlatformStats(event.block.timestamp)
}

export function handleModerationStatusUpdated(event: ModerationStatusUpdated): void {
  let content = Content.load(event.params.contentId.toString())
  
  if (content != null) {
    let previousStatus = content.moderationStatus
    content.moderationStatus = event.params.status
    content.updatedAt = event.block.timestamp
    content.save()
    
    // Create moderation event
    let moderationEvent = new ModerationEvent(
      event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
    )
    
    moderationEvent.content = content.id
    moderationEvent.previousStatus = previousStatus
    moderationEvent.newStatus = event.params.status
    moderationEvent.moderator = event.params.moderator
    moderationEvent.timestamp = event.block.timestamp
    moderationEvent.transactionHash = event.transaction.hash
    
    moderationEvent.save()
  }
}

export function handleContentPriceUpdated(event: ContentPriceUpdated): void {
  let content = Content.load(event.params.contentId.toString())
  
  if (content != null) {
    content.priceUSDC = event.params.newPrice
    content.updatedAt = event.block.timestamp
    content.save()
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
  
  stats.totalContent = stats.totalContent + 1
  stats.lastUpdated = timestamp
  
  stats.save()
}