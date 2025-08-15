import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Address, BigInt } from "@graphprotocol/graph-ts"
import { CreatorRegistered } from "../generated/CreatorRegistry/CreatorRegistry"
import { handleCreatorRegistered } from "../src/creator-registry"
import { createCreatorRegisteredEvent } from "./creator-registry-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let creator = Address.fromString("0x0000000000000000000000000000000000000001")
    let timestamp = BigInt.fromI32(234)
    let newCreatorRegisteredEvent = createCreatorRegisteredEvent(creator, timestamp)
    handleCreatorRegistered(newCreatorRegisteredEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("Creator created and stored", () => {
    assert.entityCount("Creator", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "Creator",
      "0x0000000000000000000000000000000000000001",
      "wallet",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "Creator",
      "0x0000000000000000000000000000000000000001",
      "ageVerified",
      "false"
    )
    assert.fieldEquals(
      "Creator",
      "0x0000000000000000000000000000000000000001",
      "talentVerified",
      "false"
    )
    assert.fieldEquals(
      "Creator",
      "0x0000000000000000000000000000000000000001",
      "totalEarnings",
      "0"
    )
    assert.fieldEquals(
      "Creator",
      "0x0000000000000000000000000000000000000001",
      "contentCount",
      "0"
    )

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  })

  test("Platform stats updated", () => {
    assert.entityCount("PlatformStats", 1)
    assert.fieldEquals("PlatformStats", "platform", "totalCreators", "1")
  })
})