import { BigInt } from "@graphprotocol/graph-ts"
import {
  OrganizationCreated,
  MemberAdded,
  MemberRemoved,
  MemberRoleUpdated
} from "../generated/OrganizationRegistry/OrganizationRegistry"
import { Organization, OrgMember, Creator, OrganizationEvent, PlatformStats } from "../generated/schema"

export function handleOrganizationCreated(event: OrganizationCreated): void {
  let organization = new Organization(event.params.orgId.toString())
  
  // Load or create owner
  let owner = Creator.load(event.params.owner.toHexString())
  if (owner == null) {
    owner = new Creator(event.params.owner.toHexString())
    owner.wallet = event.params.owner
    owner.ageVerified = false
    owner.talentVerified = false
    owner.totalEarnings = BigInt.fromI32(0)
    owner.contentCount = 0
    owner.createdAt = event.block.timestamp
    owner.updatedAt = event.block.timestamp
    owner.save()
  }
  
  // Set organization properties
  organization.name = event.params.name
  organization.owner = owner.id
  organization.orgType = event.params.orgType
  organization.isActive = true
  organization.memberCount = 1 // Owner is first member
  organization.totalContent = 0
  organization.totalEarnings = BigInt.fromI32(0)
  organization.createdAt = event.block.timestamp
  organization.updatedAt = event.block.timestamp
  
  organization.save()
  
  // Update creator's organization
  owner.organization = organization.id
  owner.updatedAt = event.block.timestamp
  owner.save()
  
  // Create owner as first member
  let ownerMember = new OrgMember(
    event.params.orgId.toString() + "-" + event.params.owner.toHexString()
  )
  
  ownerMember.organization = organization.id
  ownerMember.member = owner.id
  ownerMember.role = 0 // Owner role
  ownerMember.uploadQuota = BigInt.fromI32(0) // Unlimited for owner
  ownerMember.isActive = true
  ownerMember.joinedAt = event.block.timestamp
  ownerMember.updatedAt = event.block.timestamp
  
  ownerMember.save()
  
  // Create organization event
  let orgEvent = new OrganizationEvent(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  
  orgEvent.organization = organization.id
  orgEvent.eventType = "created"
  orgEvent.timestamp = event.block.timestamp
  orgEvent.transactionHash = event.transaction.hash
  
  orgEvent.save()
  
  // Update platform stats
  updatePlatformStats(event.block.timestamp)
}

export function handleMemberAdded(event: MemberAdded): void {
  let organization = Organization.load(event.params.orgId.toString())
  
  if (organization != null) {
    // Load or create member
    let member = Creator.load(event.params.member.toHexString())
    if (member == null) {
      member = new Creator(event.params.member.toHexString())
      member.wallet = event.params.member
      member.ageVerified = false
      member.talentVerified = false
      member.totalEarnings = BigInt.fromI32(0)
      member.contentCount = 0
      member.createdAt = event.block.timestamp
      member.updatedAt = event.block.timestamp
    }
    
    // Set member's organization
    member.organization = organization.id
    member.updatedAt = event.block.timestamp
    member.save()
    
    // Create org member
    let orgMember = new OrgMember(
      event.params.orgId.toString() + "-" + event.params.member.toHexString()
    )
    
    orgMember.organization = organization.id
    orgMember.member = member.id
    orgMember.role = event.params.role
    orgMember.uploadQuota = event.params.uploadQuota
    orgMember.isActive = true
    orgMember.joinedAt = event.block.timestamp
    orgMember.updatedAt = event.block.timestamp
    
    orgMember.save()
    
    // Update organization member count
    organization.memberCount = organization.memberCount + 1
    organization.updatedAt = event.block.timestamp
    organization.save()
    
    // Create organization event
    let orgEvent = new OrganizationEvent(
      event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
    )
    
    orgEvent.organization = organization.id
    orgEvent.eventType = "member_added"
    orgEvent.member = member.id
    orgEvent.newRole = event.params.role
    orgEvent.timestamp = event.block.timestamp
    orgEvent.transactionHash = event.transaction.hash
    
    orgEvent.save()
  }
}

export function handleMemberRemoved(event: MemberRemoved): void {
  let organization = Organization.load(event.params.orgId.toString())
  let member = Creator.load(event.params.member.toHexString())
  
  if (organization != null && member != null) {
    let orgMemberId = event.params.orgId.toString() + "-" + event.params.member.toHexString()
    let orgMember = OrgMember.load(orgMemberId)
    
    if (orgMember != null) {
      orgMember.isActive = false
      orgMember.updatedAt = event.block.timestamp
      orgMember.save()
      
      // Update organization member count
      organization.memberCount = organization.memberCount - 1
      organization.updatedAt = event.block.timestamp
      organization.save()
      
      // Remove organization from member
      member.organization = null
      member.updatedAt = event.block.timestamp
      member.save()
      
      // Create organization event
      let orgEvent = new OrganizationEvent(
        event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
      )
      
      orgEvent.organization = organization.id
      orgEvent.eventType = "member_removed"
      orgEvent.member = member.id
      orgEvent.timestamp = event.block.timestamp
      orgEvent.transactionHash = event.transaction.hash
      
      orgEvent.save()
    }
  }
}

export function handleMemberRoleUpdated(event: MemberRoleUpdated): void {
  let organization = Organization.load(event.params.orgId.toString())
  let member = Creator.load(event.params.member.toHexString())
  
  if (organization != null && member != null) {
    let orgMemberId = event.params.orgId.toString() + "-" + event.params.member.toHexString()
    let orgMember = OrgMember.load(orgMemberId)
    
    if (orgMember != null) {
      let oldRole = orgMember.role
      orgMember.role = event.params.newRole
      orgMember.updatedAt = event.block.timestamp
      orgMember.save()
      
      // Update organization
      organization.updatedAt = event.block.timestamp
      organization.save()
      
      // Create organization event
      let orgEvent = new OrganizationEvent(
        event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
      )
      
      orgEvent.organization = organization.id
      orgEvent.eventType = "role_updated"
      orgEvent.member = member.id
      orgEvent.oldRole = oldRole
      orgEvent.newRole = event.params.newRole
      orgEvent.timestamp = event.block.timestamp
      orgEvent.transactionHash = event.transaction.hash
      
      orgEvent.save()
    }
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
  
  stats.totalOrganizations = stats.totalOrganizations + 1
  stats.lastUpdated = timestamp
  
  stats.save()
}