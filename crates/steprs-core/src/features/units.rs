use crate::output::UnitMetadata;

/// Scan only the STEP header/schema — avoid allocating the full DATA section.
const HEADER_SCAN_BYTES: usize = 65_536;

pub fn detect_units(bytes: &[u8], bbox_max_dimension: f64) -> UnitMetadata {
    let scan_len = bytes.len().min(HEADER_SCAN_BYTES);
    let upper = String::from_utf8_lossy(&bytes[..scan_len]).to_ascii_uppercase();

    if upper.contains(".MILLI.") && upper.contains(".METRE.") {
        return UnitMetadata {
            detected_unit: "millimetre".into(),
            confidence: 0.95,
            scale_to_mm: 1.0,
            source: "SI_UNIT(.MILLI.,.METRE.)".into(),
        };
    }

    if upper.contains("'MILLIMETRE'") || upper.contains("'MILLI'") {
        return UnitMetadata {
            detected_unit: "millimetre".into(),
            confidence: 0.9,
            scale_to_mm: 1.0,
            source: "CONVERSION_BASED_UNIT(MILLI)".into(),
        };
    }

    if upper.contains(".INCH.") || upper.contains("'INCH'") {
        return UnitMetadata {
            detected_unit: "inch".into(),
            confidence: 0.92,
            scale_to_mm: 25.4,
            source: "SI_UNIT(.INCH.)".into(),
        };
    }

    if upper.contains(".METRE.") || upper.contains("CONVERSION_BASED_UNIT( 'METRE'") {
        if bbox_max_dimension <= 2.0 {
            return UnitMetadata {
                detected_unit: "metre".into(),
                confidence: 0.88,
                scale_to_mm: 1000.0,
                source: "SI_UNIT(.METRE.) with sub-2m geometry".into(),
            };
        }
        return UnitMetadata {
            detected_unit: "metre".into(),
            confidence: 0.75,
            scale_to_mm: 1000.0,
            source: "SI_UNIT(.METRE.)".into(),
        };
    }

    if upper.contains("AUTOMOTIVE_DESIGN") {
        return UnitMetadata {
            detected_unit: "millimetre".into(),
            confidence: 0.88,
            scale_to_mm: 1.0,
            source: "AUTOMOTIVE_DESIGN schema".into(),
        };
    }

    if bbox_max_dimension > 0.0 && bbox_max_dimension <= 2000.0 {
        return UnitMetadata {
            detected_unit: "millimetre".into(),
            confidence: 0.7,
            scale_to_mm: 1.0,
            source: "part envelope (≤2 m)".into(),
        };
    }

    UnitMetadata {
        detected_unit: "unknown".into(),
        confidence: 0.3,
        scale_to_mm: 1.0,
        source: "fallback".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_metre_from_si_unit() {
        let bytes = b"SI_UNIT( $, .METRE. )CARTESIAN_POINT('',(0.01,0.02,0.03));";
        let units = detect_units(bytes, 0.03);
        assert_eq!(units.detected_unit, "metre");
        assert!((units.scale_to_mm - 1000.0).abs() < f64::EPSILON);
    }

    #[test]
    fn detects_automotive_design_as_mm() {
        let bytes = b"FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));CARTESIAN_POINT('',(10.0,0.0,0.0));";
        let units = detect_units(bytes, 10.0);
        assert_eq!(units.detected_unit, "millimetre");
        assert!((units.scale_to_mm - 1.0).abs() < f64::EPSILON);
    }
}
