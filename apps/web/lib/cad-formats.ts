/** Native CAD formats — export guidance only (no in-browser conversion). */

export interface CadFormat {
  id: string;
  name: string;
  extensions: string[];
  /** Commonly exported to STEP for downstream CAM */
  common: boolean;
  exportSteps: string[];
}

export const CAD_FORMATS: CadFormat[] = [
  {
    id: "step",
    name: "STEP / STP",
    extensions: [".step", ".stp"],
    common: true,
    exportSteps: ["Already supported. Drop it above."],
  },
  {
    id: "solidworks",
    name: "SolidWorks",
    extensions: [".sldprt", ".sldasm", ".slddrw"],
    common: true,
    exportSteps: [
      "File → Save As → STEP (*.step)",
      "Options: AP214 (config control) or AP203; include units in mm",
      "For assemblies, use File → Pack and Go, then export each part",
    ],
  },
  {
    id: "inventor",
    name: "Autodesk Inventor",
    extensions: [".ipt", ".iam", ".idw"],
    common: true,
    exportSteps: [
      "File → Save Copy As → STEP Files (*.stp)",
      "Enable “Export as single file” for assemblies when possible",
    ],
  },
  {
    id: "fusion",
    name: "Fusion 360",
    extensions: [".f3d", ".f3z"],
    common: true,
    exportSteps: [
      "File → Export → STEP (*.stp)",
      "Use “Reference model” for large assemblies",
    ],
  },
  {
    id: "mastercam",
    name: "Mastercam",
    extensions: [".mcam", ".mcx-9"],
    common: true,
    exportSteps: [
      "Open the source CAD model in its native app and export STEP",
      "Mastercam part files are not interchangeable. Use STEP as the handoff format.",
    ],
  },
  {
    id: "parasolid",
    name: "Parasolid",
    extensions: [".x_t", ".x_b"],
    common: true,
    exportSteps: [
      "Re-export from the originating CAD as STEP AP214",
      "Many CAM tools accept Parasolid, but steprs reads STEP only",
    ],
  },
  {
    id: "iges",
    name: "IGES",
    extensions: [".igs", ".iges"],
    common: true,
    exportSteps: [
      "Open in FreeCAD or your CAD → Export → STEP",
      "Prefer STEP over IGES for holes, units, and assembly metadata",
    ],
  },
  {
    id: "catia",
    name: "CATIA",
    extensions: [".catpart", ".catproduct"],
    common: false,
    exportSteps: [
      "File → Save As → STEP (*.stp)",
      "Use AP214 for prismatic/machined parts",
    ],
  },
  {
    id: "creo",
    name: "Creo / Pro-E",
    extensions: [".prt", ".asm"],
    common: false,
    exportSteps: [
      "File → Save As → STEP (*.stp)",
      "Set export profile to AP214 and mm units",
    ],
  },
  {
    id: "nx",
    name: "Siemens NX",
    extensions: [".prt"],
    common: false,
    exportSteps: ["File → Export → STEP214 → choose part or assembly"],
  },
  {
    id: "stl",
    name: "STL (mesh)",
    extensions: [".stl"],
    common: true,
    exportSteps: [
      "STL is triangle mesh only. Reopen the original solid model and export STEP.",
      "Mesh files cannot recover holes, threads, or exact faces",
    ],
  },
  {
    id: "3mf",
    name: "3MF (mesh)",
    extensions: [".3mf"],
    common: true,
    exportSteps: [
      "3MF is a packaged mesh format. Reopen the original solid model and export STEP.",
      "Use Fusion, SolidWorks, or FreeCAD to export AP214 STEP with mm units",
    ],
  },
  {
    id: "dxf",
    name: "DXF / DWG (2D)",
    extensions: [".dxf", ".dwg"],
    common: true,
    exportSteps: [
      "2D drawings are not 3D solids. Export STEP from the 3D source model.",
    ],
  },
];

const EXT_MAP = new Map<string, CadFormat>();
for (const fmt of CAD_FORMATS) {
  for (const ext of fmt.extensions) {
    EXT_MAP.set(ext, fmt);
  }
}

export function extensionOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i).toLowerCase() : "";
}

export function isStepFile(filename: string): boolean {
  const ext = extensionOf(filename);
  return ext === ".step" || ext === ".stp";
}

export function lookupCadFormat(filename: string): CadFormat | undefined {
  return EXT_MAP.get(extensionOf(filename));
}

export const ACCEPTED_DROP_EXTENSIONS = [
  ...new Set(CAD_FORMATS.flatMap((f) => f.extensions)),
];
