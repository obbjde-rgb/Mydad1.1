export const getSurahDisplayName = (name: string) => {
  if (!name || typeof name !== 'string') return '';
  return name.includes('سورة') || name.includes('سُورَة') ? name : `سورة ${name}`;
};

export const safeLocalStorageGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.error("Failed to read from localStorage:", e);
    return null;
  }
};

export const safeLocalStorageRemove = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error("Failed to remove from localStorage:", e);
  }
};

export const safeLocalStorageSet = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.error("Failed to save to localStorage:", e);
    if ((e as any).name === 'QuotaExceededError') {
      try {
        // Try to clear up space by pruning midad_all_chats instead of wiping everything
        const allChatsStr = localStorage.getItem('midad_all_chats');
        if (allChatsStr) {
          const chats = JSON.parse(allChatsStr);
          if (Array.isArray(chats) && chats.length > 5) {
            const pinned = chats.filter((c: any) => c.pinned);
            const unpinned = chats.filter((c: any) => !c.pinned);
            // Keep only pinned chats plus the 3 most recent unpinned chats
            const pruned = [...pinned, ...unpinned.slice(0, 3)].slice(0, 8);
            localStorage.setItem('midad_all_chats', JSON.stringify(pruned));
            
            // Try saving the key again
            localStorage.setItem(key, value);
            return;
          }
        }
      } catch (innerErr) {
        console.error("Failed to prune chats to recover localStorage space:", innerErr);
      }

      // If we still fail, clear only specific non-critical keys
      try {
        const nonCriticalKeys = ['midad_speech_voice', 'midad_custom_instructions'];
        nonCriticalKeys.forEach(k => localStorage.removeItem(k));
        localStorage.setItem(key, value);
        return;
      } catch (innerErr) {}

      // Absolute last resort fallback: do NOT clear everything if we don't have to,
      // but if we must, warn the developer and only clear history keys
      console.warn("localStorage quota exceeded, performing soft clear of history keys only");
      try {
        localStorage.removeItem('midad_alrahman_history');
        localStorage.setItem(key, value);
      } catch (lastErr) {
        console.error("Complete localStorage failure:", lastErr);
      }
    }
  }
};

export const parseAIJson = <T>(text: string, defaultValue: T): T => {
  if (!text) return defaultValue;
  try {
    // Attempt direct parse
    return JSON.parse(text) as T;
  } catch (e) {
    try {
      // Clean up markdown block wrappers and leading/trailing spaces
      let cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      
      // Sometimes LLMs output additional conversational text before or after the JSON block.
      // Use regex to find the first '{' and the last '}' or first '[' and last ']'
      const objMatch = cleanText.match(/\{[\s\S]*\}/);
      const arrMatch = cleanText.match(/\[[\s\S]*\]/);
      
      if (objMatch && arrMatch) {
         // Determine which one encompasses the other or comes first
         if (objMatch[0].length > arrMatch[0].length) {
            cleanText = objMatch[0];
         } else {
            cleanText = arrMatch[0];
         }
      } else if (objMatch) {
        cleanText = objMatch[0];
      } else if (arrMatch) {
        cleanText = arrMatch[0];
      }

      return JSON.parse(cleanText) as T;
    } catch (innerError) {
      console.warn("Failed to parse AI JSON output:", innerError, "Text was:", text.substring(0, 100));
      return defaultValue;
    }
  }
};
