export type EntityType = 'transaction' | 'account' | 'category'
export type OperationType = 'create' | 'update' | 'delete'

export interface QueueItem {
  localId?: number
  entityType: EntityType
  operationType: OperationType
  entityId: string
  payload: Record<string, unknown>
  createdAt: string
  status: 'pending' | 'processing' | 'failed'
  retryCount: number
}
