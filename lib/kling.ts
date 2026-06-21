// Kling AI Video Generation wrapper
// Docs: https://app.klingai.com/global/dev/document-api
// Set KLING_API_KEY in .env.local to enable video teasers

const KLING_BASE_URL = 'https://api-singapore.klingai.com'

export interface KlingVideoOptions {
  prompt: string
  duration?: '5' | '10'
  aspectRatio?: '16:9' | '9:16' | '1:1'
  model?: 'kling-v1' | 'kling-v1-5'
}

export interface KlingVideoResult {
  url: string | null
  taskId: string | null
  error: string | null
}

export async function generateAuctionTeaser(
  options: KlingVideoOptions
): Promise<KlingVideoResult> {
  const apiKey = process.env.KLING_API_KEY

  if (!apiKey) {
    console.warn('[Kling] No API key — video teaser disabled, using image fallback')
    return { url: null, taskId: null, error: 'no_api_key' }
  }

  try {
    const res = await fetch(`${KLING_BASE_URL}/v1/videos/text2video`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_name: options.model ?? 'kling-v1-5',
        prompt: options.prompt,
        duration: options.duration ?? '5',
        aspect_ratio: options.aspectRatio ?? '16:9',
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { url: null, taskId: null, error: JSON.stringify(err) }
    }

    const data = await res.json()
    const taskId = data?.data?.task_id ?? null
    return { url: null, taskId, error: null }
  } catch (e) {
    return { url: null, taskId: null, error: String(e) }
  }
}
