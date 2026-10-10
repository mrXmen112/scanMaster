/**
 * AI Diagnostics — structured error logging for AI API routes.
 * Logs structured diagnostic info server-side only, never exposes internal
 * details to the client.
 */

export interface AiDiagnosticContext {
  route: string
  feature: string
  provider?: string
  userId?: string
  requestId?: string
  textLength?: number
  imageSize?: number
  pdfPages?: number
  durationMs?: number
  statusCode?: number
  errorCode?: string
  errorMessage?: string
  fallbackUsed?: string
}

export function logAiDiagnostic(ctx: AiDiagnosticContext): void {
  const { route, feature, statusCode, errorCode, durationMs, fallbackUsed } = ctx
  const level = statusCode && statusCode >= 400 ? 'ERROR' : 'INFO'
  const parts = [
    `[AI-DIAG:${level}]`,
    `route=${route}`,
    `feature=${feature}`,
    `status=${statusCode || 'unknown'}`,
  ]
  if (errorCode) parts.push(`error=${errorCode}`)
  if (durationMs != null) parts.push(`duration=${durationMs}ms`)
  if (fallbackUsed) parts.push(`fallback=${fallbackUsed}`)
  if (ctx.provider) parts.push(`provider=${ctx.provider}`)
  if (ctx.userId) parts.push(`userId=${ctx.userId.substring(0, 12)}...`)
  if (ctx.textLength) parts.push(`textLen=${ctx.textLength}`)
  if (ctx.pdfPages) parts.push(`pdfPages=${ctx.pdfPages}`)

  if (statusCode && statusCode >= 400) {
    console.error(parts.join(' | '), ctx.errorMessage || '')
  } else {
    console.log(parts.join(' | '))
  }
}

export function createRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}