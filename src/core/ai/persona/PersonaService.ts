import { debugLog } from '../../utils/debugLog';
import { DEFAULT_PERSONA_PROFILE } from './PersonaProfile';
import type { PersonaProfile } from './PersonaProfile';
import { usePreferenceStore } from '../../memory/PreferenceMemoryStore';

export class PersonaService {
  #profile: PersonaProfile;

  constructor() {
    this.#profile = DEFAULT_PERSONA_PROFILE;
  }

  getProfile(): PersonaProfile {
    return this.#profile;
  }

  // Phase 7.4: Merge preference overrides onto canonical profile (D-11)
  getActiveProfile(): PersonaProfile {
    const prefs = usePreferenceStore.getState();
    const profile: PersonaProfile = { ...DEFAULT_PERSONA_PROFILE };

    // Apply identity overrides
    if (prefs.aiName) {
      profile.identity = { ...profile.identity, name: prefs.aiName };
    }
    // Apply language style overrides
    if (prefs.aiTone) {
      profile.languageStyle = { ...profile.languageStyle, tone: prefs.aiTone };
    }
    if (prefs.responseBrevity) {
      let style: string;
      switch (prefs.responseBrevity) {
        case 'concise':
          style = 'Concise by default with task-aware expansion';
          break;
        case 'balanced':
          style = 'Balanced — moderately detailed with context-appropriate expansion';
          break;
        case 'detailed':
          style = 'Detailed with thorough explanations';
          break;
        default:
          style = 'Balanced — moderately detailed with context-appropriate expansion';
      }
      profile.languageStyle = { ...profile.languageStyle, responseStyle: style };
    }

    debugLog('info', '[PersonaService] getActiveProfile — merged preference overrides');
    return profile;
  }
}

export const personaService = new PersonaService();
