export interface SidePanelPageRegistration {
  id: string;
  label: string;
  icon: string;
  component: React.ComponentType;
}

export interface StandalonePageRegistration {
  id: string;
  label: string;
  icon: string;
  component: React.ComponentType;
}

export interface AddonRegistration {
  id: string;
  name: string;
  sidePanelPages?: SidePanelPageRegistration[];
  standalonePages?: StandalonePageRegistration[];
}
