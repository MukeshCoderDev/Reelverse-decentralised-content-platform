import { BigInt, Bytes, log } from "@graphprotocol/graph-ts"
import {
  CreatorRegistered,
  CreatorVerified,
  CreatorUpdated
} from "../generated/CreatorRegistry/CreatorRegistry"
import { Creator, AuditLog, PlatformMetrics } from "../generated/schema"

export function handleCreatorRegistered(event: CreatorRegistered): void {
  let creator = new Creator(event.params.creator.toHexString())
  
  creator.walletAddress = event.params.creator
  creator.isVerified = false
  creator.totalEarnings = BigInt.fromI32(0)
  creator.totalContent = BigInt.fromI32(0)
  creator.createdAt = event.block.timestamp
  creator.updatedAt = event.block.timestamp
  
  creator.save()
  
  // Update platform metrics
  updatePlatformMetrics()
  
  // Create audit log
  createAuditLog(
    "Creator",
    event.params.creator.toHexString(),
    "REGISTERED",
    event.params.creator,
    `{"profileURI": "${event.params.profileURI}"}`,
    event
  )
  
  log.info("Creator registered: {}", [event.params.creator.toHexString()])
}

export function handleCreatorVerified(event: CreatorVerified): void {
  let creator = Creator.load(event.params.creator.toHexString())
  
  if (creator == null) {
    log.error("Creator not found for verification: {}", [event.params.creator.toHexString()])
    return
  }
  
  creator.isVerified = true
  creator.verificationSBT = event.params.sbtTokenId
  creator.updatedAt = event.block.timestamp
  
  creator.save()
  
  // Create audit log
  createAuditLog(
    "Creator",
    event.params.creator.toHexString(),
    "VERIFIED",
    event.params.creator,
    `{"sbtTokenId": "${event.params.sbtTokenId.toString()}"}`,
    event
  )
  
  log.info("Creator verified: {}", [event.params.creator.toHexString()])
}

export function handleCreatorUpdated(event: CreatorUpdated): void {
  let creator = Creator.load(event.params.creator.toHexString())
  
  if (creator == null) {
    log.error("Creator not found for update: {}", [event.params.creator.toHexString()])
    return
  }
  
  creator.updatedAt = event.block.timestamp
  creator.save()
  
  // Create audit log
  createAuditLog(
    "Creator",
    event.params.creator.toHexString(),
    "UPDATED",
    event.params.creator,
    `{"profileURI": "${event.params.profileURI}"}`,
    event
  )
  
  log.info("Creator updated: {}", [event.params.creator.toHexString()])
}

function updatePlatformMetrics(): void {
  let metrics = PlatformMetrics.load("current")
  
  if (metrics == null) {
    metrics = new PlatformMetrics("current")
    metrics.totalCreators = BigInt.fromI32(0)
    metrics.totalContent = BigInt.fromI32(0)
    metrics.totalRevenue = BigInt.fromI32(0)
    metrics.totalPayouts = BigInt.fromI32(0)
    metrics.averageJoinTime = BigInt.fromI32(1200) // 1.2 seconds in ms
    metrics.rebufferRate = BigInt.fromI32(80) // 0.8% in basis points
    metrics.uptimePercentage = BigInt.fromI32(9998) // 99.98% in basis points
  }
  
  metrics.totalCreators = metrics.totalCreators.plus(BigInt.fromI32(1))
  metrics.lastUpdated = BigInt.fromI32(Date.now() as i32)
  
  metrics.save()
}

function createAuditLog(
  entity: string,
  entityId: string,
  action: string,
  actor: Bytes,
  metadata: string,
  event: any
): void {
  let auditId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let audit = new AuditLog(auditId)
  
  audit.entity = entity
  audit.entityId = entityId
  audit.action = action
  audit.actor = actor
  audit.metadata = metadata
  audit.timestamp = event.block.timestamp
  audit.transactionHash = event.transaction.hash
  
  audit.save()
}