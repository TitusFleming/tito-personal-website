export type Candidate = {
  id: string;
  full_name: string;
  party: string | null;
  website_url: string | null;
  incumbent: boolean;
  status: string;
  /**
   * True when this candidate has reported money to the FEC. It is a
   * display grouping, never a filter — a real campaign whose first report
   * hasn't landed yet reads as unfunded, so nothing is hidden on it.
   */
  funded: boolean;
  receipts: number | null;
  disbursements: number | null;
  cash_on_hand: number | null;
  individual_contributions: number | null;
  pac_contributions: number | null;
  /** Figures above are "as of" this date; always show it alongside them. */
  coverage_end_date: string | null;
  hq_city: string | null;
  hq_state: string | null;
  /** Only present for sitting members running again. */
  officeholder: Officeholder | null;
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
  photo_url: string | null;
  phone: string | null;
  office_address: string | null;
  in_office_since: number | null;
  sponsored_count: number | null;
  cosponsored_count: number | null;
  leadership_role: string | null;
  /** Subjects they most often file bills about — not policy positions. */
  policy_areas: string | null;
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
