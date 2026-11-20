export type MediaKind = 'image' | 'video' | 'audio'
export type FrameFormat = 'portrait' | 'square' | 'landscape'

export interface MediaAsset {
  id: string
  file: File
  name: string
  url: string
  kind: MediaKind
  duration: number
}

export interface VideoClip {
  id: string
  assetId: string
  name: string
  url: string
  kind: 'image' | 'video'
  sourceDuration: number
  inPoint: number
  outPoint: number
}

export interface OverlayText {
  title: string
  subtitle: string
}

export const clipLength = (clip: VideoClip) => Math.max(0.25, clip.outPoint - clip.inPoint)

export const totalLength = (clips: VideoClip[]) => clips.reduce((sum, clip) => sum + clipLength(clip), 0)

export function clipAtTime(clips: VideoClip[], time: number) {
  let cursor = 0
  for (const clip of clips) {
    const length = clipLength(clip)
    if (time < cursor + length || clip === clips[clips.length - 1]) {
      return { clip, start: cursor, localTime: Math.max(0, Math.min(length, time - cursor)) }
    }
    cursor += length
  }
  return null
}
