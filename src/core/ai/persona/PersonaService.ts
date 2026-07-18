import { debugLog } from '../../utils/debugLog';
import { DEFAULT_PERSONA_PROFILE } from './PersonaProfile';
import type { PersonaProfile } from './PersonaProfile';

export class PersonaService {
  #profile: PersonaProfile;

  constructor() {
    this.#profile = DEFAULT_PERSONA_PROFILE;
  }

  getProfile(): PersonaProfile {
    return this.#profile;
  }
}

export const personaService = new PersonaService();
