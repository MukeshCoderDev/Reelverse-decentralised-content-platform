import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts"
import {
  CreatorRegistered,
  VerificationStatusUpdated,
  EarningsUpdated
} from "../generated/CreatorRegistry/CreatorRegistry"

export function createCreatorRegisteredEvent(
  creator: Address,
  timestamp: BigInt
): CreatorRegistered {
  let creatorRegisteredEvent = changetype<CreatorRegistered>(newMockEvent())

  creatorRegisteredEvent.parameters = new Array()

  creatorRegisteredEvent.parameters.push(
    new ethereum.EventParam("creator", ethereum.Value.fromAddress(creator))
  )
  creatorRegisteredEvent.parameters.push(
    new ethereum.EventParam("timestamp", ethereum.Value.fromUnsignedBigInt(timestamp))
  )

  return creatorRegisteredEvent
}

export function createVerificationStatusUpdatedEvent(
  creator: Address,
  ageVerified: boolean,
  talentVerified: boolean
): VerificationStatusUpdated {
  let verificationStatusUpdatedEvent = changetype<VerificationStatusUpdated>(
    newMockEvent()
  )

  verificationStatusUpdatedEvent.parameters = new Array()

  verificationStatusUpdatedEvent.parameters.push(
    new ethereum.EventParam("creator", ethereum.Value.fromAddress(creator))
  )
  verificationStatusUpdatedEvent.parameters.push(
    new ethereum.EventParam("ageVerified", ethereum.Value.fromBoolean(ageVerified))
  )
  verificationStatusUpdatedEvent.parameters.push(
    new ethereum.EventParam("talentVerified", ethereum.Value.fromBoolean(talentVerified))
  )

  return verificationStatusUpdatedEvent
}

export function createEarningsUpdatedEvent(
  creator: Address,
  totalEarnings: BigInt
): EarningsUpdated {
  let earningsUpdatedEvent = changetype<EarningsUpdated>(newMockEvent())

  earningsUpdatedEvent.parameters = new Array()

  earningsUpdatedEvent.parameters.push(
    new ethereum.EventParam("creator", ethereum.Value.fromAddress(creator))
  )
  earningsUpdatedEvent.parameters.push(
    new ethereum.EventParam("totalEarnings", ethereum.Value.fromUnsignedBigInt(totalEarnings))
  )

  return earningsUpdatedEvent
}