import { getProvider } from '../providers'
import { OpenAICompatAdapter } from './openai-compat'

export class MistralAdapter extends OpenAICompatAdapter {
  constructor() {
    super(getProvider('mistral'))
  }

  protected defaultModelId(): string {
    return 'mistral-large-latest'
  }
}