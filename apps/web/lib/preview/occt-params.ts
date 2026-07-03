/** Tessellation params for occt-import-js ReadStepFile — output in mm. */
export const OCCT_TESSELLATION_PARAMS = {
  linearUnit: "millimeter" as const,
  linearDeflectionType: "bounding_box_ratio" as const,
  linearDeflection: 0.001,
  angularDeflection: 0.5,
};
