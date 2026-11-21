import { getProvider } from '../providers'
import { OpenAICompatAdapter } from './openai-compat'

export class OpenAIAdapter extends OpenAICompatAdapter {
  constructor() {
    super(getProvider('openai'))
  }

  protected defaultModelId(): string {
    return 'gpt-4o-mini'
  }
}