//! Minimal STEP parsing helpers for face/edge entity mapping.

use std::collections::HashMap;

/// STEP entity refs listed on the first `CLOSED_SHELL` in document order.
pub fn shell_face_entity_refs(step: &str) -> Result<Vec<u32>, String> {
    let entities = parse_entities(step)?;
    let shell_ref = find_first_closed_shell(&entities)?;
    let shell = entities
        .get(&shell_ref)
        .ok_or_else(|| format!("CLOSED_SHELL #{shell_ref} missing"))?;
    parse_hash_ref_list(&shell.attrs)
}

/// Endpoint coordinates for a STEP `EDGE_CURVE` entity (native file units).
pub fn edge_curve_endpoints(step: &str, edge_id: u32) -> Result<([f64; 3], [f64; 3]), String> {
    let entities = parse_entities(step)?;
    let entity = entities
        .get(&(edge_id as u64))
        .ok_or_else(|| format!("EDGE_CURVE #{edge_id} missing"))?;
    if entity.entity_type != "EDGE_CURVE" {
        return Err(format!("#{edge_id} is not EDGE_CURVE"));
    }
    let refs = parse_hash_refs(&entity.attrs);
    let v0 = refs
        .first()
        .copied()
        .ok_or("EDGE_CURVE missing start vertex")?;
    let v1 = refs
        .get(1)
        .copied()
        .ok_or("EDGE_CURVE missing end vertex")?;
    Ok((
        resolve_vertex_point(&entities, v0)?,
        resolve_vertex_point(&entities, v1)?,
    ))
}

fn resolve_vertex_point(
    entities: &HashMap<u64, StepEntity>,
    vertex_id: u32,
) -> Result<[f64; 3], String> {
    let vertex = entities
        .get(&(vertex_id as u64))
        .ok_or_else(|| format!("VERTEX_POINT #{vertex_id} missing"))?;
    if vertex.entity_type != "VERTEX_POINT" {
        return Err(format!("#{vertex_id} is not VERTEX_POINT"));
    }
    let point_ref = parse_hash_refs(&vertex.attrs)
        .first()
        .copied()
        .ok_or("VERTEX_POINT missing geometry")?;
    let point = entities
        .get(&(point_ref as u64))
        .ok_or_else(|| format!("CARTESIAN_POINT #{point_ref} missing"))?;
    if point.entity_type != "CARTESIAN_POINT" {
        return Err(format!("#{point_ref} is not CARTESIAN_POINT"));
    }
    parse_cartesian_triplet(&point.attrs)
}

fn parse_cartesian_triplet(attrs: &str) -> Result<[f64; 3], String> {
    let floats = parse_floats(attrs);
    if floats.len() < 3 {
        return Err("CARTESIAN_POINT missing coordinates".into());
    }
    Ok([floats[0], floats[1], floats[2]])
}

fn parse_floats(s: &str) -> Vec<f64> {
    let mut out = Vec::new();
    let mut i = 0;
    let bytes = s.as_bytes();
    while i < bytes.len() {
        if bytes[i] == b'(' {
            i += 1;
            while i < bytes.len() && bytes[i] != b')' {
                let start = i;
                while i < bytes.len()
                    && (bytes[i].is_ascii_digit()
                        || bytes[i] == b'.'
                        || bytes[i] == b'-'
                        || bytes[i] == b'+'
                        || bytes[i] == b'e'
                        || bytes[i] == b'E')
                {
                    i += 1;
                }
                if start < i {
                    if let Ok(v) = std::str::from_utf8(&bytes[start..i])
                        .unwrap_or("")
                        .parse::<f64>()
                    {
                        out.push(v);
                    }
                }
                while i < bytes.len()
                    && bytes[i] != b')'
                    && !bytes[i].is_ascii_digit()
                    && bytes[i] != b'.'
                    && bytes[i] != b'-'
                {
                    i += 1;
                }
            }
            i += 1;
        } else {
            i += 1;
        }
    }
    out
}

fn find_first_closed_shell(entities: &HashMap<u64, StepEntity>) -> Result<u64, String> {
    for (id, entity) in entities {
        if entity.entity_type == "CLOSED_SHELL" {
            return Ok(*id);
        }
    }
    Err("No CLOSED_SHELL found in STEP".into())
}

#[derive(Debug)]
struct StepEntity {
    entity_type: String,
    attrs: String,
}

fn parse_entities(input: &str) -> Result<HashMap<u64, StepEntity>, String> {
    let data_start = input
        .find("DATA;")
        .ok_or_else(|| "no DATA section".to_string())?;
    let data_end = input[data_start..]
        .find("ENDSEC;")
        .ok_or_else(|| "no ENDSEC after DATA".to_string())?;
    let data_section = &input[data_start + 5..data_start + data_end];
    let joined = data_section.replace(['\n', '\r'], " ");

    let mut entities = HashMap::new();
    for statement in joined.split(';') {
        let stmt = statement.trim();
        if stmt.is_empty() {
            continue;
        }
        let Some(eq_pos) = stmt.find('=') else {
            continue;
        };
        let id_part = stmt[..eq_pos].trim();
        let rest = stmt[eq_pos + 1..].trim();
        let Some(id) = parse_entity_id(id_part) else {
            continue;
        };
        let Some(paren_pos) = rest.find('(') else {
            continue;
        };
        let entity_type = rest[..paren_pos].trim().to_uppercase();
        let attrs = rest[paren_pos + 1..].trim().to_string();
        entities.insert(id, StepEntity { entity_type, attrs });
    }
    Ok(entities)
}

fn parse_entity_id(s: &str) -> Option<u64> {
    let s = s.trim_start_matches('#').trim();
    s.parse().ok()
}

fn parse_hash_ref_list(attrs: &str) -> Result<Vec<u32>, String> {
    let refs = parse_hash_refs(attrs);
    if refs.is_empty() {
        return Err("CLOSED_SHELL has no face references".into());
    }
    Ok(refs)
}

fn parse_hash_refs(s: &str) -> Vec<u32> {
    let mut out = Vec::new();
    let mut i = 0;
    let bytes = s.as_bytes();
    while i < bytes.len() {
        if bytes[i] == b'#' {
            i += 1;
            let start = i;
            while i < bytes.len() && bytes[i].is_ascii_digit() {
                i += 1;
            }
            if let Ok(id) = std::str::from_utf8(&bytes[start..i])
                .unwrap_or("")
                .parse::<u32>()
            {
                out.push(id);
            }
        } else {
            i += 1;
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_closed_shell_face_refs() {
        let step = r#"ISO-10303-21;
HEADER;
FILE_DESCRIPTION((),'');
FILE_NAME('x','',(''),(''),'','','');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));
ENDSEC;
DATA;
#1 = CLOSED_SHELL('', (#10, #11, #12));
#10 = ADVANCED_FACE('',(),#100,.T.);
ENDSEC;
END-ISO-10303-21;"#;
        let refs = shell_face_entity_refs(step).expect("refs");
        assert_eq!(refs, vec![10, 11, 12]);
    }
}
