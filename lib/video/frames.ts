'use client'

/**
 * Compresses a video in the browser: a few small stills with their times. The
 * original file never leaves the device, and the server gets about a megabyte
 * instead of a phone's full-size video.
 */

export const MAX_VIDEO_SECONDS = 15
const FRAMES_PER_SECOND = 2
const MAX_SIDE = 480
const JPEG_QUALITY = 0.6

export interface VideoFrame {
  /** Seconds from the start of the video. */
  t: number
  /** JPEG, base64, without the data: prefix. */
  data: string
}

export class VideoError extends Error {
  constructor(readonly code: 'too_long' | 'unreadable') {
    super(code)
  }
}

function once(target: HTMLVideoElement, event: string, ms = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      target.removeEventListener(event, done)
      reject(new VideoError('unreadable'))
    }, ms)
    function done() {
      clearTimeout(timer)
      target.removeEventListener(event, done)
      resolve()
    }
    target.addEventListener(event, done)
  })
}

async function seek(video: HTMLVideoElement, t: number) {
  const seeked = once(video, 'seeked')
  video.currentTime = t
  await seeked
}

/** Recordings made in a browser often report no length until the end has been read. */
async function realDuration(video: HTMLVideoElement): Promise<number> {
  if (Number.isFinite(video.duration)) return video.duration
  await seek(video, 1e7)
  const duration = Number.isFinite(video.duration) ? video.duration : video.currentTime
  await seek(video, 0)
  return duration
}

/** Stills of the first 15 seconds; `trimmed` when the video was longer (a phone clip often is). */
export async function extractFrames(file: Blob): Promise<{ frames: VideoFrame[]; trimmed: boolean }> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = url
  try {
    await once(video, 'loadedmetadata')
    const full = await realDuration(video)
    if (!full) throw new VideoError('unreadable')
    const trimmed = full > MAX_VIDEO_SECONDS + 0.5
    const duration = Math.min(full, MAX_VIDEO_SECONDS)
    const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new VideoError('unreadable')
    const frames: VideoFrame[] = []
    const count = Math.max(1, Math.min(Math.floor(duration * FRAMES_PER_SECOND), MAX_VIDEO_SECONDS * FRAMES_PER_SECOND))
    for (let i = 0; i < count; i++) {
      const t = Math.min(duration - 0.05, (i * duration) / count)
      await seek(video, Math.max(0, t))
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      frames.push({ t: Math.round(t * 10) / 10, data: canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1] })
    }
    return { frames, trimmed }
  } catch (error) {
    throw error instanceof VideoError ? error : new VideoError('unreadable')
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}
