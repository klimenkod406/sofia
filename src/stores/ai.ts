'use client'

import { create } from 'zustand'
import { AIModel, AIChat, AIMessage } from '@/types'

export type { AIModel, AIChat, AIMessage, ChatMessage, ChatOptions } from '@/types'

interface AIState {
  currentChat: AIChat | null
  messages: AIMessage[]
  availableModels: AIModel[]
  currentModel: AIModel | null
  
  setCurrentChat: (chat: AIChat | null) => void
  setMessages: (messages: AIMessage[]) => void
  addMessage: (message: AIMessage) => void
  setAvailableModels: (models: AIModel[]) => void
  setCurrentModel: (model: AIModel | null) => void
}

export const useAI = create<AIState>((set) => ({
  currentChat: null,
  messages: [],
  availableModels: [],
  currentModel: null,
  
  setCurrentChat: (chat) => set({ currentChat: chat }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setAvailableModels: (models) => set({ availableModels: models }),
  setCurrentModel: (model) => set({ currentModel: model }),
}))