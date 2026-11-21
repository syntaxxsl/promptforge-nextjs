import { getProvider } from '../providers'
import { OpenAICompatAdapter } from './openai-compat'

export class XaiAdapter extends OpenAICompatAdapter {
  constructor() {
    super(getProvider('xai'))
  }

  protected defaultModelId(): string {
    return 'grok-2'
  }
}