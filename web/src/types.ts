export type PostContextType = 'post' | 'comment'

export interface PostContext {
  author: string
  text: string
  type: PostContextType
  url: string
  capturedAt: number
}

export interface GenerateRequest {
  context: PostContext
}

export interface GenerateResponse {
  text: string
}

