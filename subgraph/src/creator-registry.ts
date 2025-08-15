import { BigInt, Address } from "@graphprotocol/graph-ts"
import {
  CreatorRegistered,
  VerificationStatusUpdated,
  EarningsUpdated
} from "../generated/CreatorRegistry/CreatorRegistry"
import { Creator, VerificationEvent, PlatformStats } from "../generated/schema"

export function handleCreatorRegistered(event: CreatorRegistered): void {
  let creator = new Creator(event.params.creator.toHexString())
  
  creator.wallet = event.params.creator
  creator.ageVerified = false
  creator.talentVerified = false
  creator.totalEarnings = BigInt.fromI32(0)
  creator.contentCount = 0
  creator.createdAt = event.block.timestamp
  creator.updatedAt = event.block.timestamp
  
  creator.save()
  
  // Update platform stats
  updatePlatformStats(event.block.timestamp)
}

export function handleVerificationStatusUpdated(event: VerificationStatusUpdated): void {
  let creator = Creator.load(event.params.creator.toHexString())
  
  if (creator == null) {
    // Create creator if doesn't exist
    creator = new Creator(event.params.creator.toHexString())
    creator.wallet = event.params.creator
    creator.totalEarnings = BigInt.fromI32(0)
    creator.contentCount = 0
    creator.createdAt = event.block.timestamp
  }
  
  creator.ageVerified = event.params.ageVerified
  creator.talentVerified = event.params.talentVerified
  creator.updatedAt = event.block.timestamp
  
  creator.save()
  
  // Create verification event
  let verificationEvent = new VerificationEvent(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  
  verificationEvent.creator = creator.id
  verificationEvent.ageVerified = event.params.ageVerified
  verificationEvent.talentVerified = event.params.talentVerified
  verificationEvent.timestamp = event.block.timestamp
  verificationEvent.transactionHash = event.transaction.hash
  
  verificationEvent.save()
}

export function handleEarningsUpdated(event: EarningsUpdated): void {
  let creator = Creator.load(event.params.creator.toHexString())
  
  if (creator != null) {
    creator.totalEarnings = event.params.totalEarnings
    creator.updatedAt = event.block.timestamp
    creator.save()
    
    // Update platform stats
    updatePlatformStats(event.block.timestamp)
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
  
  // Count total creators
  // Note: In a real implementation, you'd want to use a more efficient method
  // This is simplified for demonstration
  stats.totalCreators = stats.totalCreators + 1
  stats.lastUpdated = timestamp
  
  stats.save()
}