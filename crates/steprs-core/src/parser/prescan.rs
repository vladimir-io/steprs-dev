use nom::bytes::complete::tag;
use nom::character::complete::{char, digit1, multispace0};
use nom::combinator::map_res;
use nom::sequence::preceded;
use nom::IResult;

use crate::core::DENSITY_THRESHOLD;
use crate::parser::scan::{
    advance_to_next_entity, find_data_section, is_data_end, skip_whitespace,
};

#[derive(Debug, Clone)]
pub struct PrescanResult {
    pub entity_count: usize,
    pub max_id: u32,
    pub density: f64,
}

impl PrescanResult {
    pub fn storage_mode_label(&self) -> &'static str {
        if self.density >= DENSITY_THRESHOLD {
            "dense"
        } else {
            "sparse"
        }
    }

    pub fn from_counts(entity_count: usize, max_id: u32) -> Self {
        let density = if max_id == 0 && entity_count == 0 {
            0.0
        } else {
            entity_count as f64 / (max_id as f64 + 1.0)
        };
        Self {
            entity_count,
            max_id,
            density,
        }
    }
}

pub fn prescan_ids(bytes: &[u8]) -> Result<PrescanResult, String> {
    let data = find_data_section(bytes).map_err(|e| e.to_string())?;
    let mut remaining = data;
    let mut entity_count = 0usize;
    let mut max_id = 0u32;

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

        match parse_id_only(remaining) {
            Ok((rest, id)) => {
                entity_count += 1;
                max_id = max_id.max(id);
                remaining = rest;
            }
            Err(_) => {
                remaining = advance_to_next_entity(remaining).unwrap_or(&[]);
            }
        }
    }

    if entity_count == 0 {
        return Err("No STEP entities found in DATA section".into());
    }

    Ok(PrescanResult::from_counts(entity_count, max_id))
}

fn parse_id_only(input: &[u8]) -> IResult<&[u8], u32> {
    let (input, id) = map_res(preceded(char('#'), digit1), |s: &[u8]| {
        std::str::from_utf8(s)
            .unwrap_or("0")
            .parse::<u32>()
            .map_err(|_| {
                nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Digit))
            })
    })(input)?;
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("=")(input)?;
    Ok((input, id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prescan_computes_density() {
        let input = b"DATA;\n#1=FOO();\n#2=BAR();\n#1000000=BAZ();";
        let result = prescan_ids(input).unwrap();
        assert_eq!(result.entity_count, 3);
        assert_eq!(result.max_id, 1_000_000);
        assert!(result.density < 0.5);
        assert_eq!(result.storage_mode_label(), "sparse");
    }
}
