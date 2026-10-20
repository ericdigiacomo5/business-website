// Run with `npm test`.

import { test } from "node:test"
import assert from "node:assert/strict"
import { artistOffersAll, joinNames, servicesNotOffered } from "./artist-services"

test("an artist with no list performs every service", () => {
    assert.deepEqual(servicesNotOffered([], ["a", "b"]), [])
    assert.equal(artistOffersAll([], ["a", "b"]), true)
})

test("services outside the artist's list are reported, in the order asked for", () => {
    assert.deepEqual(servicesNotOffered(["b"], ["c", "a", "b"]), ["c", "a"])
    assert.equal(artistOffersAll(["a", "b"], ["b", "a"]), true)
    assert.equal(artistOffersAll(["a"], ["a", "b"]), false)
})

test("joinNames reads as a sentence", () => {
    assert.equal(joinNames([]), "")
    assert.equal(joinNames(["Wax"]), "Wax")
    assert.equal(joinNames(["Wax", "Pedicure"]), "Wax and Pedicure")
    assert.equal(joinNames(["A", "B", "C"]), "A, B and C")
})
