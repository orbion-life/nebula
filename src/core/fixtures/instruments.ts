import type { InstrumentProfile } from "../types";

/**
 * Instrument profiles.
 *
 * An InstrumentProfile is a first-class INPUT to Discover: its detection noise
 * floor, static-field range, and RF availability decide whether each route's
 * simulated signature is observable, which changes the experiment ranking.
 * These are public, transparent capability envelopes — not device secrets.
 */
export const INSTRUMENT_PROFILES: InstrumentProfile[] = [
  {
    id: "benchtop_field_fluorimeter",
    label: "Benchtop fluorimeter + static-field coil",
    readoutModes: ["fluorescence", "lifetime"],
    minDetectableDeltaFOverF: 1e-3,
    integrationTimeS: 1,
    staticFieldRange_mT: [0, 50],
    rfAvailable: false,
    rfFreqRange_MHz: [0, 0],
    rfB1_mT: 0,
    illuminationControllable: true,
    oxygenControl: true,
    temperatureControl: true,
    notes:
      "Low-noise fluorescence with a Helmholtz static-field sweep; no RF. Can resolve a small magnetofluorescence curve if controls are held.",
  },
  {
    id: "odmr_confocal",
    label: "Confocal ODMR bench (field + RF)",
    readoutModes: ["fluorescence", "ODMR_like", "lifetime"],
    minDetectableDeltaFOverF: 5e-4,
    integrationTimeS: 5,
    staticFieldRange_mT: [0, 10],
    rfAvailable: true,
    rfFreqRange_MHz: [1, 400],
    rfB1_mT: 0.1,
    illuminationControllable: true,
    oxygenControl: true,
    temperatureControl: true,
    notes:
      "Lowest-noise, RF-capable. Enables ODMR-like and RF-resonance experiments; limited static-field range.",
  },
  {
    id: "plate_reader_screen",
    label: "High-throughput plate reader",
    readoutModes: ["fluorescence"],
    minDetectableDeltaFOverF: 5e-3,
    integrationTimeS: 0.2,
    staticFieldRange_mT: [0, 5],
    rfAvailable: false,
    rfFreqRange_MHz: [0, 0],
    rfB1_mT: 0,
    illuminationControllable: true,
    oxygenControl: false,
    temperatureControl: false,
    notes:
      "Fast and cheap but noisy, with no oxygen/temperature control and a narrow field range. Small spin-linked signals fall below its noise floor.",
  },
];

export const DEFAULT_INSTRUMENT_ID = "benchtop_field_fluorimeter";

export function instrumentById(id: string): InstrumentProfile | undefined {
  return INSTRUMENT_PROFILES.find((p) => p.id === id);
}

export function defaultInstrument(): InstrumentProfile {
  return instrumentById(DEFAULT_INSTRUMENT_ID)!;
}
