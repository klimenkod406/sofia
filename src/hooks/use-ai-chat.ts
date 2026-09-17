'use client';

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AIChat, AIMessage, AIModel, ChatMessage } from '@/types';

export function useAIChat() {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState<AIModel | null>(null);
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [currentChat, setCurrentChat] = useState<AIChat | null>(null);

  const loadModels = useCallback(async () => {
    try {
      const models = (await invoke('get_available_models')) as AIModel[];
      setAvailableModels(models);
      if (!currentModel && models.length > 0) {
        setCurrentModel(models[0]);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  }, [currentModel]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const createChat = useCallback(async (noteId?: string, modelId?: string) => {
    const chat = (await invoke('create_ai_chat', { noteId, modelId })) as AIChat;
    setCurrentChat(chat);
    setMessages([]);
    return chat;
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!currentChat) {
        await createChat();
      }
      if (!currentChat) return;

      // Add user message
      const userMessage: AIMessage = {
        id: `temp-${Date.now()}`,
        chat_id: currentChat.id,
        role: 'user',
        content: text,
        tokens_used: 0,
        tool_calls: null,
        tool_call_id: null,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);

      try {
        // Add to backend
        await invoke('add_ai_message', { chatId: currentChat.id, role: 'user', content: text });

        // Get AI response
        const completion = (await invoke('chat_completion', {
          messages: [...messages, { role: 'user', content: text }].map(m => ({
            role: m.role,
            content: m.content,
          })),
          modelId: currentModel?.id,
          options: { temperature: 0.7, max_tokens: 4096, top_p: 0.9, stream: false },
        })) as { message: ChatMessage; tokens_used: number; model: string };

        // Add assistant message
        const assistantMessage: AIMessage = {
          id: `temp-${Date.now() + 1}`,
          chat_id: currentChat.id,
          role: 'assistant',
          content: completion.message.content,
          tokens_used: completion.tokens_used,
          tool_calls: null,
          tool_call_id: null,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        await invoke('add_ai_message', {
          chatId: currentChat.id,
          role: 'assistant',
          content: completion.message.content,
        });
      } catch (error) {
        console.error('Failed to send message:', error);
        // Add error message
        const errorMessage: AIMessage = {
          id: `temp-${Date.now() + 1}`,
          chat_id: currentChat.id,
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          tokens_used: 0,
          tool_calls: null,
          tool_call_id: null,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [currentChat, currentModel, messages, createChat]
  );

  const setModel = useCallback(
    (model: AIModel) => {
      setCurrentModel(model);
      if (currentChat) {
        invoke('update_ai_chat', { chatId: currentChat.id, modelId: model.id });
      }
    },
    [currentChat]
  );

  const clearChat = useCallback(async () => {
    if (currentChat) {
      await invoke('clear_chat_messages', { chatId: currentChat.id });
      setMessages([]);
    }
  }, [currentChat]);

  return {
    messages,
    isLoading,
    currentModel,
    availableModels,
    currentChat,
    sendMessage,
    createChat,
    setModel,
    clearChat,
    loadModels,
  };
}
