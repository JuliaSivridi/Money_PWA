export interface SheetsGetResponse {
  range?: string
  majorDimension?: string
  values?: string[][]
}

export interface SheetsBatchUpdateRequest {
  valueInputOption: 'RAW' | 'USER_ENTERED'
  data: { range: string; values: string[][] }[]
}
