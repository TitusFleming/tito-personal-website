export type Candidate = {
  id: string;
  full_name: string;
  party: string | null;
  website_url: string | null;
  incumbent: boolean;
  status: string;
};

export type RaceGroup = {
  office_id: string;
  office_title: string;
  office_type: string;
  party: string | null;
  candidates: Candidate[];
};

export type ElectionsByZipResponse = {
  zip: string;
  election_name: string;
  election_date: string;
  races: RaceGroup[];
  state: string | null;
  districts: number[];
};

export type ElectionScopeResponse = {
  state: string;
  district: number | null;
  election_name: string;
  election_date: string;
  races: RaceGroup[];
};

export type Officeholder = {
  full_name: string;
  party: string;
  website_url: string | null;
  district: number | null;
  senate_class: number | null;
};

export type StateOverview = {
  name: string;
  house: Record<string, number>;
  house_districts: number;
  senators: Officeholder[];
  senate_race_2026: boolean;
};

export type MapOverview = {
  states: Record<string, StateOverview>;
};

export type DistrictInfo = {
  district: number;
  incumbent: Officeholder | null;
  has_races: boolean;
};

export type MapStateDetail = {
  state: string;
  name: string;
  districts: DistrictInfo[];
  senators: Officeholder[];
  senate_race_2026: boolean;
};
