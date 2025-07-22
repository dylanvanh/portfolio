export type EnvironmentItem = {
  name: string;
  href: string;
};

export type EnvironmentItems = {
  unix: EnvironmentItem[];
  windows: EnvironmentItem[];
};
