export interface SidePanelPageRegistration {
  id: string;
  label: string;
  icon: string;
  component: React.ComponentType;
}

export interface FullAppPageRegistration {
  id: string;
  label: string;
  icon: string;
  component: React.ComponentType;
}

export interface AddonRegistration {
  id: string;
  name: string;
  sidePanelPages?: SidePanelPageRegistration[];
  fullAppPages?: FullAppPageRegistration[];
}
