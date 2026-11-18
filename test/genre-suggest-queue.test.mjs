// Lives outside app/ so Nuxt never auto-imports it into the bundle.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  GENRE_SUGGEST_MAX_RATE_LIMIT_RETRIES,
  GENRE_SUGGEST_MIN_INTERVAL_MS,
  GENRE_SUGGEST_RATE_LIMIT_BACKOFF_MS,
  isRateLimitError,
  runGenreSuggestQueue,
} from '../app/utils/genreSuggestQueue.ts'

// A fake clock that only moves when the queue sleeps, so spacing is exact.
function createClock() {
  const clock = { time: 0, sleeps: [] }
  clock.now = () => clock.time
  clock.sleep = async (ms) => {
    clock.sleeps.push(ms)
    clock.time += ms
  }
  return clock
}

function rateLimitError() {
  return Object.assign(new Error('Too Many Requests'), { statusCode: 429 })
}

test('every item is suggested, each start spaced by the minimum interval', async () => {
  const clock = createClock()
  const startedAt = []
  const result = await runGenreSuggestQueue(['a', 'b', 'c'], {
    suggest: async () => { startedAt.push(clock.time) },
    onFailure: () => assert.fail('no failure expected'),
    shouldContinue: () => true,
    sleep: clock.sleep,
    now: clock.now,
  })
  assert.equal(result, 'completed')
  assert.deepEqual(startedAt, [0, GENRE_SUGGEST_MIN_INTERVAL_MS, GENRE_SUGGEST_MIN_INTERVAL_MS * 2])
})

test('a slow request counts toward the interval rather than adding to it', async () => {
  const clock = createClock()
  const startedAt = []
  await runGenreSuggestQueue(['a', 'b'], {
    suggest: async () => {
      startedAt.push(clock.time)
      clock.time += GENRE_SUGGEST_MIN_INTERVAL_MS + 1000
    },
    onFailure: () => {},
    shouldContinue: () => true,
    sleep: clock.sleep,
    now: clock.now,
  })
  assert.deepEqual(clock.sleeps, [])
  assert.deepEqual(startedAt, [0, GENRE_SUGGEST_MIN_INTERVAL_MS + 1000])
})

test('an ordinary failure is reported and the queue moves on', async () => {
  const clock = createClock()
  const suggested = []
  const failed = []
  const result = await runGenreSuggestQueue(['a', 'b'], {
    suggest: async (item) => {
      if (item === 'a') { throw Object.assign(new Error('boom'), { statusCode: 500 }) }
      suggested.push(item)
    },
    onFailure: item => failed.push(item),
    shouldContinue: () => true,
    sleep: clock.sleep,
    now: clock.now,
  })
  assert.equal(result, 'completed')
  assert.deepEqual(failed, ['a'])
  assert.deepEqual(suggested, ['b'])
})

test('a rate limit backs off and retries the same item', async () => {
  const clock = createClock()
  let calls = 0
  const result = await runGenreSuggestQueue(['a'], {
    suggest: async () => {
      calls += 1
      if (calls === 1) { throw rateLimitError() }
    },
    onFailure: () => assert.fail('no failure expected'),
    shouldContinue: () => true,
    sleep: clock.sleep,
    now: clock.now,
  })
  assert.equal(result, 'completed')
  assert.equal(calls, 2)
  assert.deepEqual(clock.sleeps, [GENRE_SUGGEST_RATE_LIMIT_BACKOFF_MS])
})

test('a lasting rate limit stops the queue and leaves the rest untouched', async () => {
  const clock = createClock()
  const attempted = []
  const failed = []
  const result = await runGenreSuggestQueue(['a', 'b'], {
    suggest: async (item) => {
      attempted.push(item)
      throw rateLimitError()
    },
    onFailure: item => failed.push(item),
    shouldContinue: () => true,
    sleep: clock.sleep,
    now: clock.now,
  })
  assert.equal(result, 'rate_limited')
  assert.deepEqual(failed, ['a'])
  assert.equal(attempted.length, GENRE_SUGGEST_MAX_RATE_LIMIT_RETRIES + 1)
  assert.ok(!attempted.includes('b'))
})

test('cancelling stops before the next request', async () => {
  const clock = createClock()
  const suggested = []
  let isActive = true
  const result = await runGenreSuggestQueue(['a', 'b'], {
    suggest: async (item) => {
      suggested.push(item)
      isActive = false
    },
    onFailure: () => {},
    shouldContinue: () => isActive,
    sleep: clock.sleep,
    now: clock.now,
  })
  assert.equal(result, 'cancelled')
  assert.deepEqual(suggested, ['a'])
})

test('an item filled in before its turn is skipped without a request or a wait', async () => {
  const clock = createClock()
  const suggested = []
  const settled = []
  const result = await runGenreSuggestQueue(['a', 'b', 'c'], {
    suggest: async (item) => { suggested.push(item) },
    onFailure: () => assert.fail('no failure expected'),
    onSettled: item => settled.push(item),
    shouldSkip: item => item === 'b',
    shouldContinue: () => true,
    sleep: clock.sleep,
    now: clock.now,
  })
  assert.equal(result, 'completed')
  assert.deepEqual(suggested, ['a', 'c'])
  assert.deepEqual(settled, ['a', 'b', 'c'])
  assert.deepEqual(clock.sleeps, [GENRE_SUGGEST_MIN_INTERVAL_MS])
})

// In both cases the author fills the item in while the queue sleeps.
test('an item filled in during the pacing wait is skipped rather than requested', async () => {
  const clock = createClock()
  const filled = new Set()
  const attempted = []
  const settled = []
  await runGenreSuggestQueue(['a', 'b'], {
    suggest: async (item) => { attempted.push(item) },
    onFailure: () => assert.fail('no failure expected'),
    onSettled: item => settled.push(item),
    shouldSkip: item => filled.has(item),
    shouldContinue: () => true,
    sleep: async (ms) => {
      filled.add('b')
      await clock.sleep(ms)
    },
    now: clock.now,
  })
  assert.deepEqual(attempted, ['a'])
  assert.deepEqual(settled, ['a', 'b'])
})

test('an item filled in during the rate-limit backoff is not retried', async () => {
  const clock = createClock()
  const filled = new Set()
  let calls = 0
  const settled = []
  const result = await runGenreSuggestQueue(['a'], {
    suggest: async () => {
      calls += 1
      throw rateLimitError()
    },
    onFailure: () => assert.fail('no failure expected'),
    onSettled: item => settled.push(item),
    shouldSkip: item => filled.has(item),
    shouldContinue: () => true,
    sleep: async (ms) => {
      filled.add('a')
      await clock.sleep(ms)
    },
    now: clock.now,
  })
  assert.equal(result, 'completed')
  assert.equal(calls, 1)
  assert.deepEqual(settled, ['a'])
})

test('both ofetch status fields count as a rate limit', () => {
  assert.equal(isRateLimitError({ status: 429 }), true)
  assert.equal(isRateLimitError({ statusCode: 429 }), true)
  assert.equal(isRateLimitError({ statusCode: 500 }), false)
  assert.equal(isRateLimitError(undefined), false)
})
