import test from 'node:test';
import assert from 'node:assert/strict';
import { localizedStudioAIError } from '../app/studio-ai-client-error';

test('provider errors offer localized practitioner recovery without raw operator diagnostics', () => {
  for (const locale of ['en', 'ru'] as const) {
    for (const code of ['authentication', 'permission', 'model_unavailable', 'quota', 'rate_limited', 'bad_request', 'rejected', 'unavailable', 'future_code']) {
      const message = localizedStudioAIError(locale, `provider_${code}`, 'RAW API key billing diagnostic');
      assert.doesNotMatch(message, /RAW|API key|billing|OpenAI API/);
      assert.match(message, locale === 'en' ? /retry|Retry|administrator|editing/ : /попытку|администратор|редактирование/);
    }
    const messages = ['provider_quota', 'provider_rate_limited', 'provider_permission', 'refused', 'invalid_output', 'stale_context']
      .map(code => localizedStudioAIError(locale, code, 'RAW'));
    assert.equal(new Set(messages).size, messages.length, 'distinct recovery outcomes remain distinct');
    assert.equal(localizedStudioAIError(locale, 'provider_future', null), localizedStudioAIError(locale, 'provider_unavailable', null));
    assert.equal(typeof localizedStudioAIError(locale, null, null), 'string');
  }
});
