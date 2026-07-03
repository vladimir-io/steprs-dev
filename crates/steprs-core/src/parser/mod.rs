pub mod prescan;
pub mod scan;

use nom::branch::alt;
use nom::bytes::complete::{tag, take_while1};
use nom::character::complete::{char, digit1, multispace0, space0};
use nom::combinator::{map, map_res, value};
use nom::multi::separated_list0;
use nom::number::complete::double;
use nom::sequence::{delimited, preceded};
use nom::IResult;

use crate::arena::Arena;
use crate::entity::StepEntity;
use crate::output::ParsedEntity;
use crate::parser::scan::{
    advance_to_next_entity, find_data_section, is_data_end, skip_whitespace,
};

pub use prescan::{prescan_ids, PrescanResult};
pub use scan::split_step_sections;

pub fn ingest_step(
    bytes: &[u8],
) -> Result<(Arena, Vec<ParsedEntity>, PrescanResult, usize), String> {
    let data = find_data_section(bytes).map_err(|e| e.to_string())?;
    let mut remaining = data;
    let mut parsed = Vec::new();
    let mut max_id = 0u32;
    let mut entities_skipped = 0usize;

    while !remaining.is_empty() {
        remaining = skip_whitespace(remaining);
        if is_data_end(remaining) {
            break;
        }
        if !remaining.starts_with(b"#") {
            if let Some(idx) = remaining.iter().position(|&b| b == b'#') {
                remaining = &remaining[idx..];
                continue;
            }
            break;
        }

        match parse_entity_record(remaining) {
            Ok((rest, (id, entity))) => {
                max_id = max_id.max(id);
                parsed.push(ParsedEntity {
                    id,
                    entity: entity.clone(),
                });
                remaining = rest;
            }
            Err(_) => {
                entities_skipped += 1;
                remaining = advance_to_next_entity(remaining).unwrap_or(&[]);
            }
        }
    }

    if parsed.is_empty() {
        return Err("No STEP entities parsed from DATA section".into());
    }

    let prescan = PrescanResult::from_counts(parsed.len(), max_id);
    let mut arena = Arena::from_prescan(&prescan);
    for item in &parsed {
        arena.insert(item.id, item.entity.clone());
    }

    Ok((arena, parsed, prescan, entities_skipped))
}

pub fn parse_entities(bytes: &[u8], arena: &mut Arena) -> Result<Vec<ParsedEntity>, String> {
    let data = match find_data_section(bytes) {
        Ok(d) => d,
        Err(_) if skip_whitespace(bytes).starts_with(b"#") => skip_whitespace(bytes),
        Err(e) => return Err(e.to_string()),
    };
    let mut entities = Vec::new();
    let mut remaining = data;

    while !remaining.is_empty() {
        remaining = skip_whitespace(remaining);
        if is_data_end(remaining) {
            break;
        }
        if !remaining.starts_with(b"#") {
            if let Some(idx) = remaining.iter().position(|&b| b == b'#') {
                remaining = &remaining[idx..];
                continue;
            }
            break;
        }

        match parse_entity_record(remaining) {
            Ok((rest, (id, entity))) => {
                let parsed = ParsedEntity {
                    id,
                    entity: entity.clone(),
                };
                arena.insert(id, entity);
                entities.push(parsed);
                remaining = rest;
            }
            Err(_) => {
                remaining = advance_to_next_entity(remaining).unwrap_or(&[]);
            }
        }
    }

    Ok(entities)
}

fn parse_entity_record(input: &[u8]) -> IResult<&[u8], (u32, StepEntity)> {
    let (input, id) = parse_id(input)?;
    let (input, _) = multispace0(input)?;
    let (input, _) = char('=')(input)?;
    let (input, _) = multispace0(input)?;
    let (input, entity) = parse_entity(input)?;
    Ok((input, (id, entity)))
}

fn parse_id(input: &[u8]) -> IResult<&[u8], u32> {
    map_res(preceded(char('#'), digit1), |s: &[u8]| {
        std::str::from_utf8(s)
            .map_err(|_| {
                nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Digit))
            })?
            .parse::<u32>()
            .map_err(|_| {
                nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Digit))
            })
    })(input)
}

fn parse_entity(input: &[u8]) -> IResult<&[u8], StepEntity> {
    let (input, type_name) = parse_type_name(input)?;
    let (input, params) = parse_param_list(input)?;

    let entity = build_entity(type_name, params);
    Ok((input, entity))
}

fn parse_type_name(input: &[u8]) -> IResult<&[u8], String> {
    map(
        take_while1(|c: u8| c.is_ascii_alphanumeric() || c == b'_'),
        |s: &[u8]| String::from_utf8_lossy(s).to_ascii_uppercase(),
    )(input)
}

#[derive(Debug, Clone)]
enum Param {
    Ref(u32),
    Number(f64),
    String(String),
    Enum(String),
    List(Vec<Param>),
    Ignored,
}

fn flatten_numbers(params: &[Param]) -> Vec<f64> {
    let mut numbers = Vec::new();
    for param in params {
        match param {
            Param::Number(n) => numbers.push(*n),
            Param::List(items) => numbers.extend(flatten_numbers(items)),
            _ => {}
        }
    }
    numbers
}

fn flatten_refs(params: &[Param]) -> Vec<u32> {
    let mut refs = Vec::new();
    for param in params {
        match param {
            Param::Ref(id) => refs.push(*id),
            Param::List(items) => refs.extend(flatten_refs(items)),
            _ => {}
        }
    }
    refs
}

fn parse_param_list(input: &[u8]) -> IResult<&[u8], Vec<Param>> {
    delimited(
        char('('),
        separated_list0(preceded(multispace0, char(',')), parse_param),
        preceded(multispace0, char(')')),
    )(input)
}

fn parse_step_enum(input: &[u8]) -> IResult<&[u8], String> {
    let (input, _) = char('.')(input)?;
    let (input, label) = take_while1(|c: u8| c.is_ascii_alphanumeric() || c == b'_')(input)?;
    let (input, _) = char('.')(input)?;
    Ok((input, String::from_utf8_lossy(label).to_ascii_uppercase()))
}

fn parse_param(input: &[u8]) -> IResult<&[u8], Param> {
    preceded(
        multispace0,
        alt((
            map(parse_id, Param::Ref),
            map(parse_number, Param::Number),
            map(parse_quoted_string, Param::String),
            map(parse_nested_list, Param::List),
            map(parse_step_enum, Param::Enum),
            map(parse_bare_token, Param::Enum),
            value(Param::Ignored, tag("$")),
            value(Param::Ignored, tag("*")),
        )),
    )(input)
}

fn parse_nested_list(input: &[u8]) -> IResult<&[u8], Vec<Param>> {
    delimited(
        char('('),
        separated_list0(preceded(multispace0, char(',')), parse_param),
        preceded(multispace0, char(')')),
    )(input)
}

fn parse_number(input: &[u8]) -> IResult<&[u8], f64> {
    preceded(space0, double)(input)
}

fn parse_quoted_string(input: &[u8]) -> IResult<&[u8], String> {
    let (input, _) = char('\'')(input)?;
    let mut s = String::new();
    let mut i = 0;
    while i < input.len() {
        if input[i] == b'\'' {
            if i + 1 < input.len() && input[i + 1] == b'\'' {
                s.push('\'');
                i += 2;
                continue;
            }
            return Ok((&input[i + 1..], s));
        }
        s.push(input[i] as char);
        i += 1;
    }
    Err(nom::Err::Error(nom::error::Error::new(
        input,
        nom::error::ErrorKind::Eof,
    )))
}

fn parse_bare_token(input: &[u8]) -> IResult<&[u8], String> {
    map(
        take_while1(|c: u8| c.is_ascii_alphanumeric() || c == b'_'),
        |s: &[u8]| String::from_utf8_lossy(s).to_ascii_uppercase(),
    )(input)
}

fn parse_advanced_face(params: &[Param]) -> StepEntity {
    let mut bounds = Vec::new();
    let mut face_geometry = 0u32;
    let mut same_sense = true;

    for param in params {
        match param {
            Param::List(items) => bounds = flatten_refs(items),
            Param::Ref(id) if face_geometry == 0 => face_geometry = *id,
            Param::Enum(s) if s == ".F." => same_sense = false,
            Param::Enum(s) if s == ".T." => same_sense = true,
            _ => {}
        }
    }

    StepEntity::AdvancedFace {
        bounds,
        face_geometry,
        same_sense,
    }
}

fn build_entity(type_name: String, params: Vec<Param>) -> StepEntity {
    let refs = flatten_refs(&params);
    let numbers = flatten_numbers(&params);

    match type_name.as_str() {
        "CARTESIAN_POINT" => {
            if numbers.len() < 3 {
                StepEntity::Unknown {
                    type_name,
                    refs,
                    numbers,
                    raw_line: None,
                }
            } else {
                StepEntity::CartesianPoint {
                    x: numbers[0],
                    y: numbers[1],
                    z: numbers[2],
                }
            }
        }
        "DIRECTION" => {
            if numbers.len() < 3 {
                StepEntity::Unknown {
                    type_name,
                    refs,
                    numbers,
                    raw_line: None,
                }
            } else {
                StepEntity::Direction {
                    x: numbers[0],
                    y: numbers[1],
                    z: numbers[2],
                }
            }
        }
        "AXIS2_PLACEMENT_3D" => StepEntity::Axis2Placement3d {
            location: refs.first().copied().unwrap_or(0),
            axis: refs.get(1).copied().unwrap_or(0),
            ref_direction: refs.get(2).copied().unwrap_or(0),
        },
        "CYLINDRICAL_SURFACE" => StepEntity::CylindricalSurface {
            name: params.iter().find_map(|p| match p {
                Param::String(s) => Some(s.clone()),
                _ => None,
            }),
            placement: refs.first().copied().unwrap_or(0),
            radius: numbers.first().copied().unwrap_or(0.0),
        },
        "PLANE" => StepEntity::Plane {
            placement: refs.first().copied().unwrap_or(0),
        },
        "CONICAL_SURFACE" => StepEntity::ConicalSurface {
            placement: refs.first().copied().unwrap_or(0),
            radius: numbers.first().copied().unwrap_or(0.0),
            semi_angle: numbers.get(1).copied().unwrap_or(0.0),
        },
        "TOROIDAL_SURFACE" => StepEntity::ToroidalSurface {
            placement: refs.first().copied().unwrap_or(0),
            major_radius: numbers.first().copied().unwrap_or(0.0),
            minor_radius: numbers.get(1).copied().unwrap_or(0.0),
        },
        "ADVANCED_FACE" => parse_advanced_face(&params),
        "FACE_BOUND" | "FACE_OUTER_BOUND" => StepEntity::FaceBound {
            bound: refs.first().copied().unwrap_or(0),
            orientation: params
                .iter()
                .any(|p| matches!(p, Param::Enum(s) if s == ".T.")),
        },
        "EDGE_LOOP" => StepEntity::EdgeLoop { edges: refs },
        "ORIENTED_EDGE" => StepEntity::OrientedEdge {
            edge_element: refs.first().copied().unwrap_or(0),
            orientation: params
                .iter()
                .any(|p| matches!(p, Param::Enum(s) if s == ".T.")),
        },
        "VERTEX_POINT" => StepEntity::VertexPoint {
            vertex_geometry: refs.first().copied().unwrap_or(0),
        },
        "CIRCLE" => StepEntity::Circle {
            placement: refs.first().copied().unwrap_or(0),
            radius: numbers.first().copied().unwrap_or(0.0),
        },
        "ELLIPSE" => StepEntity::Ellipse {
            placement: refs.first().copied().unwrap_or(0),
            semi_axis1: numbers.first().copied().unwrap_or(0.0),
            semi_axis2: numbers.get(1).copied().unwrap_or(0.0),
        },
        "VECTOR" => StepEntity::Vector {
            direction: refs.first().copied().unwrap_or(0),
            magnitude: numbers.first().copied().unwrap_or(1.0),
        },
        "LINE" => StepEntity::Line {
            cartesian_point: refs.first().copied().unwrap_or(0),
            vector: refs.get(1).copied().unwrap_or(0),
        },
        "EDGE_CURVE" => StepEntity::EdgeCurve {
            edge_start: refs.first().copied().unwrap_or(0),
            edge_end: refs.get(1).copied().unwrap_or(0),
            edge_geometry: refs.get(2).copied().unwrap_or(0),
            same_sense: params
                .iter()
                .any(|p| matches!(p, Param::Enum(s) if s == ".T.")),
        },
        "CLOSED_SHELL" => StepEntity::ClosedShell { faces: refs },
        "MANIFOLD_SOLID_BREP" => StepEntity::ManifoldSolidBrep {
            outer: refs.first().copied().unwrap_or(0),
        },
        _ => StepEntity::Unknown {
            type_name,
            refs,
            numbers,
            raw_line: None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::arena::Arena;
    use crate::parser::prescan::PrescanResult;

    #[test]
    fn parse_quoted_string_handles_doubled_single_quote_escape() {
        let input = b"'part''s name'";
        let (rest, s) = parse_quoted_string(input).expect("parse escaped string");
        assert!(rest.is_empty());
        assert_eq!(s, "part's name");
    }

    #[test]
    fn ingest_step_fails_when_data_section_missing() {
        match ingest_step(b"ISO-10303-21;\nHEADER;\nENDSEC;\nEND-ISO-10303-21;") {
            Err(err) => assert!(err.contains("DATA"), "{err}"),
            Ok(_) => panic!("missing DATA should fail"),
        }
    }

    #[test]
    fn cartesian_point_with_missing_coords_becomes_unknown() {
        let input = b"#1=CARTESIAN_POINT('',(1.0));";
        let prescan = PrescanResult {
            entity_count: 1,
            max_id: 1,
            density: 1.0 / 2.0,
        };
        let mut arena = Arena::from_prescan(&prescan);
        let entities = parse_entities(input, &mut arena).unwrap();
        assert!(matches!(
            entities[0].entity,
            StepEntity::Unknown { ref type_name, .. } if type_name == "CARTESIAN_POINT"
        ));
    }

    #[test]
    fn ingest_step_skips_malformed_entity_and_parses_valid_neighbors() {
        let input = b"ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\n#1=CARTESIAN_POINT('',(0.0,0.0,0.0));\n#2=NOT_A_REAL_ENTITY(((((broken;\n#3=CARTESIAN_POINT('',(1.0,1.0,1.0));\nENDSEC;\nEND-ISO-10303-21;";
        let (arena, parsed, _, skipped) = ingest_step(input).expect("ingest with skip");
        assert_eq!(skipped, 1);
        assert_eq!(parsed.len(), 2);
        assert!(arena.get(1).is_some());
        assert!(arena.get(3).is_some());
    }

    #[test]
    fn ingest_step_handles_utf8_label_in_quoted_string() {
        let input = b"ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\n#1=CARTESIAN_POINT('\xC3\xA9tiquette',(0.0,0.0,0.0));\nENDSEC;\nEND-ISO-10303-21;";
        let (_, parsed, _, _) = ingest_step(input).expect("utf8 label bytes in STEP string");
        assert_eq!(parsed.len(), 1);
    }

    #[test]
    fn parses_real_world_cartesian_point() {
        let input =
            b"#133=CARTESIAN_POINT('',(0.0190500000000000,0.0508000000000000,0.0508000000000000));";
        let prescan = PrescanResult {
            entity_count: 1,
            max_id: 133,
            density: 1.0 / 134.0,
        };
        let mut arena = Arena::from_prescan(&prescan);
        let entities = parse_entities(input, &mut arena).unwrap();
        assert_eq!(entities.len(), 1);
        assert!(matches!(
            entities[0].entity,
            StepEntity::CartesianPoint { x, .. } if (x - 0.01905).abs() < 1e-6
        ));
    }

    #[test]
    fn parses_param_list_with_nested_coordinates() {
        let input = b"( '', ( 0.0, 0.0, 0.0 ) )";
        let result = parse_param_list(input);
        assert!(result.is_ok(), "{:?}", result);
        let (rest, params) = result.unwrap();
        assert!(rest.is_empty());
        assert_eq!(params.len(), 2);
    }

    #[test]
    fn parses_advanced_face_with_cylindrical_geometry() {
        let input = b"#87=ADVANCED_FACE('',(#227),#228,.T.);";
        let result = parse_entity_record(input);
        assert!(result.is_ok(), "{:?}", result.err());
        let (_, (_, entity)) = result.unwrap();
        assert!(matches!(
            entity,
            StepEntity::AdvancedFace {
                face_geometry: 228,
                ..
            }
        ));
    }
}
