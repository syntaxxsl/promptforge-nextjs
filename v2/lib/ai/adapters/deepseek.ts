import { getProvider } from '../providers'
import { OpenAICompatAdapter } from './openai-compat'

export class DeepSeekAdapter extends OpenAICompatAdapter {
  constructor() {
    super(getProvider('deepseek'))
  }

  protected defaultModelId(): string {
    return 'deepseek-chat'
  }
}