import { db } from './db'
import type { QueueItem, EntityType, OperationType } from '@/types/sync'
import { now } from '@/utils/dateUtils'

export async function enqueue(
  entityType: EntityType,
  operationType: OperationType,
  entityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const item: QueueItem = {
    entityType,
    operationType,
    entityId,
    payload,
    createdAt: now(),
    status: 'pending',
    retryCount: 0,
  }
  await db.queue.add(item)
}

export async function getPending(): Promise<QueueItem[]> {
  return db.queue
    .where('status')
    .anyOf(['pending', 'failed'])
    .and(item => item.retryCount < 5)
    .sortBy('createdAt')
}

export async function markProcessing(localId: number): Promise<void> {
  await db.queue.update(localId, { status: 'processing' })
}

export async function markDone(localId: number): Promise<void> {
  await db.queue.delete(localId)
}

export async function markFailed(localId: number, retryCount: number): Promise<void> {
  await db.queue.update(localId, { status: 'failed', retryCount })
}

export async function getQueueLength(): Promise<number> {
  return db.queue
    .where('status')
    .anyOf(['pending', 'failed'])
    .count()
}

export async function removePendingForEntity(entityId: string): Promise<void> {
  await db.queue.where('entityId').equals(entityId).delete()
}
