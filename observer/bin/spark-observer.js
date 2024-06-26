import '../lib/instrument.js'
import * as SparkImpactEvaluator from '@filecoin-station/spark-impact-evaluator'
import { ethers } from 'ethers'
import * as Sentry from '@sentry/node'
import timers from 'node:timers/promises'

import { RPC_URL, rpcHeaders } from '../lib/config.js'
import { getPgPools } from '@filecoin-station/spark-stats-db'
import {
  observeTransferEvents,
  observeScheduledRewards
} from '../lib/observer.js'

const pgPools = await getPgPools()

const fetchRequest = new ethers.FetchRequest(RPC_URL)
fetchRequest.setHeader('Authorization', rpcHeaders.Authorization || '')
const provider = new ethers.JsonRpcProvider(fetchRequest, null, { polling: true })

const ieContract = new ethers.Contract(SparkImpactEvaluator.ADDRESS, SparkImpactEvaluator.ABI, provider)

const ONE_HOUR = 60 * 60 * 1000

const loopObserveTransferEvents = async () => {
  while (true) {
    const start = Date.now()
    try {
      await observeTransferEvents(pgPools.stats, ieContract, provider)
    } catch (e) {
      console.error(e)
      Sentry.captureException(e)
    }
    const dt = Date.now() - start
    console.log(`Observing Transfer events took ${dt}ms`)
    await timers.setTimeout(ONE_HOUR - dt)
  }
}

const loopObserveScheduledRewards = async () => {
  while (true) {
    const start = Date.now()
    try {
      await observeScheduledRewards(pgPools, ieContract)
    } catch (e) {
      console.error(e)
      Sentry.captureException(e)
    }
    const dt = Date.now() - start
    console.log(`Observing scheduled rewards took ${dt}ms`)
    await timers.setTimeout((24 * ONE_HOUR) - dt)
  }
}

await Promise.all([
  loopObserveTransferEvents(),
  loopObserveScheduledRewards()
])
