//! Shared byte scanning utilities for the DATA section.

const DATA_MARKER: &[u8] = b"DATA;";

pub fn split_step_sections(bytes: &[u8]) -> (Vec<u8>, usize) {
    if let Some(idx) = bytes
        .windows(DATA_MARKER.len())
        .position(|w| w.eq_ignore_ascii_case(DATA_MARKER))
    {
        (bytes[..idx + DATA_MARKER.len()].to_vec(), idx + DATA_MARKER.len())
    } else {
        (bytes.to_vec(), 0)
    }
}

pub fn find_data_section(bytes: &[u8]) -> Result<&[u8], &'static str> {
    if let Some(idx) = bytes
        .windows(DATA_MARKER.len())
        .position(|w| w.eq_ignore_ascii_case(DATA_MARKER))
    {
        return Ok(&bytes[idx + DATA_MARKER.len()..]);
    }
    Err("STEP file missing DATA; section")
}

pub fn skip_whitespace(input: &[u8]) -> &[u8] {
    let mut i = 0;
    while i < input.len() && (input[i] as char).is_ascii_whitespace() {
        i += 1;
    }
    &input[i..]
}

pub fn is_data_end(input: &[u8]) -> bool {
    input.starts_with(b"ENDSEC") || input.starts_with(b"END-ISO")
}

pub fn advance_to_next_entity(input: &[u8]) -> Option<&[u8]> {
    if input.is_empty() {
        return None;
    }
    let idx = input[1..].iter().position(|&b| b == b'#').map(|i| i + 1)?;
    Some(&input[idx..])
}
