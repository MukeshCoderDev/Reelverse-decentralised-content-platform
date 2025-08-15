import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts"
import {
  SplitterCreated,
  PaymentReleased,
  RevenueDistributed
} from "../generated/RevenueSplitter/RevenueSplitter"
import { RevenueSplit, PaymentEvent, PlatformStats, Content } from "../generated/schema"

export function handleSplitterCreated(event: SplitterCreated): void {
  // Splitter creation is tracked but doesn't create a RevenueSplit entity
  // RevenueSplit entities are created when actual revenue is distributed
}

export function handlePaymentReleased(event: PaymentReleased): void {
  // Create payment event for tracking
  let paymentEvent = new PaymentEvent(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  
  paymentEvent.from = event.params.splitter
  paymentEvent.to = event.params.payee
  paymentEvent.amount = event.params.amount
  paymentEvent.token = event.params.token
  paymentEvent.splitter = event.params.splitter
  paymentEvent.timestamp = event.block.timestamp
  paymentEvent.transactionHash = event.transaction.hash
  
  paymentEvent.save()
}

export function handleRevenueDistributed(event: RevenueDistributed): void {
  let revenueSplit = new RevenueSplit(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  
  revenueSplit.splitter = event.params.splitter
  revenueSplit.totalAmount = event.params.totalAmount
  revenueSplit.creatorAmount = event.params.creatorAmount
  revenueSplit.platformAmount = event.params.platformAmount
  revenueSplit.timestamp = event.block.timestamp
  revenueSplit.transactionHash = event.transaction.hash
  
  // Try to find associated content by splitter address
  // This requires iterating through content - in practice you'd want a more efficient lookup
  let content = findContentBySplitter(event.params.splitter)
  if (content != null) {
    revenueSplit.content = content.id
  }
  
  // For now, set empty arrays - in a full implementation you'd decode the actual recipients
  revenueSplit.recipients = []
  revenueSplit.amounts = []
  
  revenueSplit.save()
  
  // Update platform stats
  updatePlatformStats(event.block.timestamp, event.params.totalAmount)
}

function findContentBySplitter(splitterAddress: Bytes): Content | null {
  // In a real implementation, you'd want to maintain a mapping or use a more efficient method
  // This is a simplified approach for demonstration
  return null
}

function updatePlatformStats(timestamp: BigInt, revenue: BigInt): void {
  let stats = PlatformStats.load("platform")
  
  if (stats == null) {
    stats = new PlatformStats("platform")
    stats.totalCreators = 0
    stats.totalContent = 0
    stats.totalOrganizations = 0
    stats.totalRevenue = BigInt.fromI32(0)
    stats.totalEntitlements = 0
  }
  
  stats.totalRevenue = stats.totalRevenue.plus(revenue)
  stats.lastUpdated = timestamp
  
  stats.save()
}