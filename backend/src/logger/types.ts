export interface CustomException {
  message: string
  status?: number
  stack?: string
  options?: {
    cause?: CustomExceptionCause
  }
}

export interface CustomExceptionCause {
  message?: string
  action?: string
  meta?: {
    [key: string]: string | number | object | boolean
  }
}
